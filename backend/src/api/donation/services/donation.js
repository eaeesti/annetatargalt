"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const {
  amountToCents,
  validateIdCode,
  validateEmail,
  validateAmount,
} = require("../../../utils/donation");
const { createRecurringPaymentLink } = require("../../../utils/banks");
const { createPaymentURL } = require("../../../utils/montonio");
const { formatEstonianAmount } = require("../../../utils/estonia");
const {
  format,
  textIntoParagraphs,
  sanitize,
} = require("../../../utils/string");

module.exports = createCoreService("api::donation.donation", ({ strapi }) => ({
  async validateDonation(donation) {
    if (!donation) {
      return { valid: false, reason: "No donation provided" };
    }

    if (!donation.firstName) {
      return { valid: false, reason: "No first name provided" };
    }

    if (!donation.lastName) {
      return { valid: false, reason: "No last name provided" };
    }

    if (!donation.idCode) {
      return { valid: false, reason: "No ID code provided" };
    }

    if (!validateIdCode(donation.idCode)) {
      return { valid: false, reason: `Invalid ID code: ${donation.idCode}` };
    }

    if (!donation.email) {
      return { valid: false, reason: "No email provided" };
    }

    if (!validateEmail(donation.email)) {
      return { valid: false, reason: `Invalid email: ${donation.email}` };
    }

    if (!donation.amount) {
      return { valid: false, reason: "No amount provided" };
    }

    if (!validateAmount(donation.amount)) {
      return { valid: false, reason: `Invalid amount: ${donation.amount}` };
    }

    if (donation.amount >= 15000) {
      return { valid: false, reason: "Amount must be smaller than 15000€" };
    }

    if (!donation.type) {
      return { valid: false, reason: "No donation type provided" };
    }

    if (!["recurring", "onetime"].includes(donation.type)) {
      return {
        valid: false,
        reason: `Invalid donation type: ${donation.type}`,
      };
    }

    if (donation.companyName || donation.companyCode) {
      if (!donation.companyName) {
        return { valid: false, reason: "No company name provided" };
      }

      if (!donation.companyCode) {
        return { valid: false, reason: "No company code provided" };
      }
    }

    if (donation.dedicationName || donation.dedicationEmail) {
      if (!donation.dedicationName) {
        return { valid: false, reason: "No dedication name provided" };
      }

      if (!donation.dedicationEmail) {
        return { valid: false, reason: "No dedication email provided" };
      }

      if (!validateEmail(donation.dedicationEmail)) {
        return {
          valid: false,
          reason: `Invalid dedication email: ${donation.email}`,
        };
      }
    }

    const allProportions = [Object.values(donation.proportions)].concat(
      Object.values(donation.proportions).map(({ proportions }) =>
        Object.values(proportions)
      )
    );

    for (let proportions of allProportions) {
      const proportionSum = Object.values(proportions).reduce(
        (acc, { proportion }) => acc + proportion,
        0
      );
      if (proportionSum !== 100) {
        return {
          valid: false,
          reason: `Proportions don't add up to 100: ${proportionSum}`,
        };
      }
    }

    for (let proportions of allProportions) {
      for (let { proportion } of Object.values(proportions)) {
        if (
          !Number.isInteger(proportion) ||
          proportion < 1 ||
          proportion > 100
        ) {
          return {
            valid: false,
            reason: `Proportion must be an integer from 1 to 100: ${proportion}`,
          };
        }
      }
    }

    const causeIds = Object.keys(donation.proportions);
    for (let causeId of causeIds) {
      const cause = await strapi.entityService.findOne(
        "api::cause.cause",
        causeId
      );
      if (!cause || !cause.active) {
        return { valid: false, reason: `Not a valid cause: ${causeId}` };
      }
    }

    const organizationIds = Object.values(donation.proportions)
      .map((cause) => Object.keys(cause.proportions))
      .flat();
    for (let organizationId of organizationIds) {
      const organization = await strapi.entityService.findOne(
        "api::organization.organization",
        organizationId
      );
      if (!organization || !organization.active) {
        return {
          valid: false,
          reason: `Not a valid organization: ${organizationId}`,
        };
      }
    }

    return { valid: true };
  },

  async createMontonioPayload(donation, donor, { currency = "EUR" } = {}) {
    const donationInfo = await strapi.db
      .query("api::donation-info.donation-info")
      .findOne();

    const payload = {
      amount: donation.amount / 100,
      currency: currency,
      merchant_reference: `${donationInfo.merchantReferencePrefix} ${donation.id}`,
      merchant_return_url: `${process.env.FRONTEND_URL}/${donationInfo.returnPath}`,
      merchant_notification_url: `${process.env.MONTONIO_RETURN_URL}/confirm`,
      payment_information_unstructured: donationInfo.transactionComment,
      checkout_email: donor.email,
      checkout_first_name: donor.firstName,
      checkout_last_name: donor.lastName,
    };

    return payload;
  },

  async createSingleDonation({ donation, donor, calculations }) {
    const donationEntry = await strapi.entityService.create(
      "api::donation.donation",
      {
        data: {
          amount: amountToCents(calculations.totalAmount),
          tipSize: calculations.tipSize,
          tipAmount: amountToCents(calculations.tipAmount),
          donor: donor.id,
          datetime: new Date(),
          companyName: donation.companyName,
          companyCode: donation.companyCode,
          dedicationName: donation.dedicationName,
          dedicationEmail: donation.dedicationEmail,
          dedicationMessage: donation.dedicationMessage,
        },
      }
    );

    await strapi
      .service("api::organization-donation.organization-donation")
      .createFromProportions({
        donationId: donationEntry.id,
        donationAmount: amountToCents(donation.amount),
        proportions: donation.proportions,
      });

    const payload = await this.createMontonioPayload(donationEntry, donor);
    const redirectURL = createPaymentURL(payload);
    return { redirectURL };
  },

  async createRecurringDonation({ donation, donor, calculations }) {
    const recurringDonationEntry = await strapi.entityService.create(
      "api::recurring-donation.recurring-donation",
      {
        data: {
          amount: amountToCents(calculations.totalAmount),
          tipSize: calculations.tipSize,
          tipAmount: amountToCents(calculations.tipAmount),
          donor: donor.id,
          bank: donation.bank,
          datetime: new Date(),
          companyName: donation.companyName,
          companyCode: donation.companyCode,
        },
      }
    );

    await strapi
      .service(
        "api::organization-recurring-donation.organization-recurring-donation"
      )
      .createFromProportions({
        recurringDonationId: recurringDonationEntry.id,
        recurringDonationAmount: amountToCents(donation.amount),
        proportions: donation.proportions,
      });

    const donationInfo = await strapi.db
      .query("api::donation-info.donation-info")
      .findOne();

    const recurringPaymentLink =
      donation.bank === "other"
        ? ""
        : createRecurringPaymentLink(
            donation.bank,
            {
              iban: donationInfo.iban,
              recipient: donationInfo.recipient,
              description: donationInfo.recurringPaymentComment,
            },
            calculations.totalAmount
          );

    return {
      redirectURL: recurringPaymentLink,
      recurringDonationId: recurringDonationEntry.id,
    };
  },

  async sendConfirmationEmail(donationId) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();

    const global = await strapi.db.query("api::global.global").findOne();

    const donation = await strapi.entityService.findOne(
      "api::donation.donation",
      donationId,
      {
        fields: ["amount", "tipAmount"],
        populate: [
          "donor",
          "organizationDonations",
          "organizationDonations.organization",
        ],
      }
    );

    const template = {
      subject: emailConfig.confirmationSubject,
      text: emailConfig.confirmationText,
      html: emailConfig.confirmationHtml,
    };

    const data = {
      firstName: donation.donor.firstName,
      firstNameHtml: sanitize(donation.donor.firstName),
      lastName: donation.donor.lastName,
      lastNameHtml: sanitize(donation.donor.lastName),
      amount: formatEstonianAmount(donation.amount / 100),
      currency: global.currency,
    };

    const tip = {
      organization: { title: global.tipOrganization },
      amount: donation.tipAmount,
    };

    data.summary = donation.organizationDonations
      .concat(donation.tipAmount > 0 ? [tip] : [])
      .map((organizationDonation) => {
        const organization = organizationDonation.organization;
        const amount = formatEstonianAmount(organizationDonation.amount / 100);
        return `${organization.title}: ${amount}${global.currency}`;
      })
      .join("\n");

    await strapi.plugins["email"].services.email.sendTemplatedEmail(
      {
        to: donation.donor.email,
        replyTo: emailConfig.confirmationReplyTo,
      },
      template,
      data
    );
  },

  async sendRecurringConfirmationEmail(recurringDonationId) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();

    const global = await strapi.db.query("api::global.global").findOne();

    const recurringDonation = await strapi.entityService.findOne(
      "api::recurring-donation.recurring-donation",
      recurringDonationId,
      {
        fields: ["amount", "tipAmount"],
        populate: [
          "donor",
          "organizationRecurringDonations",
          "organizationRecurringDonations.organization",
        ],
      }
    );

    const template = {
      subject: emailConfig.recurringConfirmationSubject,
      text: emailConfig.recurringConfirmationText,
      html: emailConfig.recurringConfirmationHtml,
    };

    const data = {
      firstName: recurringDonation.donor.firstName,
      firstNameHtml: sanitize(recurringDonation.donor.firstName),
      lastName: recurringDonation.donor.lastName,
      lastNameHtml: sanitize(recurringDonation.donor.lastName),
      amount: formatEstonianAmount(recurringDonation.amount / 100),
      currency: global.currency,
    };

    const tip = {
      organization: { title: global.tipOrganization },
      amount: recurringDonation.tipAmount,
    };

    data.summary = recurringDonation.organizationRecurringDonations
      .concat(recurringDonation.tipAmount > 0 ? [tip] : [])
      .map((organizationRecurringDonation) => {
        const organization = organizationRecurringDonation.organization;
        const amount = formatEstonianAmount(
          organizationRecurringDonation.amount / 100
        );
        return `${organization.title}: ${amount}${global.currency}`;
      })
      .join("\n");

    await strapi.plugins["email"].services.email.sendTemplatedEmail(
      {
        to: recurringDonation.donor.email,
        replyTo: emailConfig.confirmationReplyTo,
      },
      template,
      data
    );
  },

  async sendDedicationEmail(donationId) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();

    const global = await strapi.db.query("api::global.global").findOne();

    const donation = await strapi.entityService.findOne(
      "api::donation.donation",
      donationId,
      {
        fields: [
          "amount",
          "tipAmount",
          "dedicationEmail",
          "dedicationMessage",
          "dedicationName",
        ],
        populate: [
          "donor",
          "organizationDonations",
          "organizationDonations.organization",
        ],
      }
    );

    const template = {
      subject: emailConfig.dedicationSubject,
    };

    template.text = format(emailConfig.dedicationText, {
      message: donation.dedicationMessage
        ? emailConfig.dedicationMessageText
        : "",
    });
    template.html = format(emailConfig.dedicationHtml, {
      messageHtml: donation.dedicationMessage
        ? emailConfig.dedicationMessageHtml
        : "",
    });

    const data = {
      dedicationName: donation.dedicationName,
      donorName: `${donation.donor.firstName} ${donation.donor.lastName}`,
      amount: formatEstonianAmount(donation.amount / 100),
      currency: global.currency,
      dedicationMessage: `"${donation.dedicationMessage}"`,
    };

    data.dedicationNameHtml = sanitize(data.dedicationName);
    data.donorNameHtml = sanitize(data.donorName);
    data.dedicationMessageHtml = textIntoParagraphs(
      sanitize(data.dedicationMessage)
    );

    const tip = {
      organization: { title: global.tipOrganization },
      amount: donation.tipAmount,
    };

    data.summary = donation.organizationDonations
      .concat(donation.tipAmount > 0 ? [tip] : [])
      .map((organizationDonation) => {
        const organization = organizationDonation.organization;
        const amount = formatEstonianAmount(organizationDonation.amount / 100);
        return `${organization.title}: ${amount}${global.currency}`;
      })
      .join("\n");

    await strapi.plugins["email"].services.email.sendTemplatedEmail(
      {
        to: donation.dedicationEmail,
        replyTo: donation.donor.email,
      },
      template,
      data
    );
  },

  async import({
    causes,
    organizations,
    donors,
    recurringDonations,
    organizationRecurringDonations,
    donations,
    organizationDonations,
  }) {
    const causeMap = {};
    for (let cause of causes) {
      const causeEntry = await strapi
        .service("api::cause.cause")
        .findOrCreateCause(cause);
      causeMap[cause.id] = causeEntry.id;
    }

    const organizationMap = {};
    for (let organization of organizations) {
      const organizationEntry = await strapi
        .service("api::organization.organization")
        .findOrCreateOrganization({
          ...organization,
          cause: organization.cause ? causeMap[organization.cause] : null,
        });
      organizationMap[organization.id] = organizationEntry.id;
    }

    const donorMap = {};
    for (let donor of donors) {
      const donorEntry = await strapi
        .service("api::donor.donor")
        .findOrCreateDonor(donor);
      donorMap[donor.id] = donorEntry.id;
    }

    const recurringDonationMap = {};
    for (let recurringDonation of recurringDonations) {
      const recurringDonationEntry = await strapi.entityService.create(
        "api::recurring-donation.recurring-donation",
        {
          data: {
            amount: recurringDonation.amount,
            tipSize: recurringDonation.tipSize,
            tipAmount: recurringDonation.tipAmount,
            donor: donorMap[recurringDonation.donor],
            bank: recurringDonation.bank,
            datetime: recurringDonation.datetime,
            companyName: recurringDonation.companyName,
            companyCode: recurringDonation.companyCode,
          },
        }
      );
      recurringDonationMap[recurringDonation.id] = recurringDonationEntry.id;
    }

    for (let organizationRecurringDonation of organizationRecurringDonations) {
      await strapi.entityService.create(
        "api::organization-recurring-donation.organization-recurring-donation",
        {
          data: {
            recurringDonation:
              recurringDonationMap[
                organizationRecurringDonation.recurringDonation
              ],
            organization:
              organizationMap[organizationRecurringDonation.organization],
            amount: organizationRecurringDonation.amount,
            proportion: organizationRecurringDonation.proportion,
          },
        }
      );
    }

    const donationMap = {};
    for (let donation of donations) {
      const donationEntry = await strapi.entityService.create(
        "api::donation.donation",
        {
          data: {
            amount: donation.amount,
            tipSize: donation.tipSize,
            tipAmount: donation.tipAmount,
            donor: donorMap[donation.donor],
            datetime: donation.datetime,
            companyName: donation.companyName,
            companyCode: donation.companyCode,
            paymentMethod: donation.paymentMethod,
            iban: donation.iban,
            finalized: donation.finalized,
            dedicationName: donation.dedicationName,
            dedicationEmail: donation.dedicationEmail,
            dedicationMessage: donation.dedicationMessage,
            recurringDonation: donation.recurringDonation
              ? recurringDonationMap[donation.recurringDonation]
              : null,
          },
        }
      );

      donationMap[donation.id] = donationEntry.id;
    }

    for (let organizationDonation of organizationDonations) {
      await strapi.entityService.create(
        "api::organization-donation.organization-donation",
        {
          data: {
            donation: donationMap[organizationDonation.donation],
            organization: organizationMap[organizationDonation.organization],
            amount: organizationDonation.amount,
            proportion: organizationDonation.proportion,
          },
        }
      );
    }
  },

  async export() {
    const causes = await strapi.entityService.findMany("api::cause.cause", {
      sort: "id",
    });

    const organizations = (
      await strapi.entityService.findMany("api::organization.organization", {
        sort: "id",
        populate: ["cause"],
      })
    ).map((organization) => ({
      ...organization,
      cause: organization.cause ? organization.cause.id : null,
    }));

    const donors = await strapi.entityService.findMany("api::donor.donor", {
      sort: "id",
    });

    const recurringDonations = (
      await strapi.entityService.findMany(
        "api::recurring-donation.recurring-donation",
        {
          sort: "id",
          populate: ["donor"],
        }
      )
    ).map((recurringDonation) => ({
      ...recurringDonation,
      donor: recurringDonation.donor.id,
    }));

    const organizationRecurringDonations = (
      await strapi.entityService.findMany(
        "api::organization-recurring-donation.organization-recurring-donation",
        {
          sort: "id",
          populate: ["recurringDonation", "organization"],
        }
      )
    ).map((organizationRecurringDonation) => ({
      ...organizationRecurringDonation,
      recurringDonation: organizationRecurringDonation.recurringDonation.id,
      organization: organizationRecurringDonation.organization.id,
    }));

    const donations = (
      await strapi.entityService.findMany("api::donation.donation", {
        sort: "id",
        populate: ["donor", "recurringDonation"],
      })
    ).map((donation) => ({
      ...donation,
      donor: donation.donor.id,
      recurringDonation: donation.recurringDonation
        ? donation.recurringDonation.id
        : null,
    }));

    const organizationDonations = (
      await strapi.entityService.findMany(
        "api::organization-donation.organization-donation",
        {
          sort: "id",
          populate: ["donation", "organization"],
        }
      )
    ).map((organizationDonation) => ({
      ...organizationDonation,
      donation: organizationDonation.donation.id,
      organization: organizationDonation.organization.id,
    }));

    return {
      causes,
      organizations,
      donors,
      recurringDonations,
      organizationRecurringDonations,
      donations,
      organizationDonations,
    };
  },

  async deleteAll() {
    await strapi.db
      .query("api::organization-donation.organization-donation")
      .deleteMany({});
    await strapi.db.query("api::donation.donation").deleteMany({});
    await strapi.db
      .query(
        "api::organization-recurring-donation.organization-recurring-donation"
      )
      .deleteMany({});
    await strapi.db
      .query("api::recurring-donation.recurring-donation")
      .deleteMany({});
    await strapi.db.query("api::donor.donor").deleteMany({});
  },

  async sumOfFinalizedDonations() {
    const result = await strapi.db.connection.raw(
      `SELECT SUM(donations.amount) AS total_amount
       FROM donations
       WHERE donations.finalized = true`
    );
    const totalAmount = Number(result.rows[0].total_amount);
    return totalAmount;
  },

  async sumOfFinalizedCampaignDonations() {
    const result = await strapi.db.connection.raw(
      `SELECT SUM(donations.amount) AS total_amount
       FROM donations
       WHERE donations.finalized = true
       AND donations.datetime >= '2023-12-01 00:00:00'
       AND donations.datetime <= '2023-12-31 23:59:59'`
    );
    const totalAmount = Number(result.rows[0].total_amount);
    return totalAmount;
  },

  async findTransactionDonation({ idCode, date, amount }) {
    const donor = await strapi.service("api::donor.donor").findDonor(idCode);

    if (!donor) {
      throw new Error("Donor not found");
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    startDate.setHours(startDate.getHours() + 2);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    endDate.setHours(endDate.getHours() + 2);

    const donations = await strapi.entityService.findMany(
      "api::donation.donation",
      {
        filters: {
          donor: donor.id,
          amount: amount * 100,
          datetime: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      }
    );

    if (donations.length === 0) {
      return null;
    }

    if (donations.length > 1) {
      throw new Error("Multiple donations found");
    }

    return donations[0];
  },

  async insertFromTransaction({ idCode, date, amount, iban }) {
    let donor = await strapi.service("api::donor.donor").findDonor(idCode);

    if (!donor) {
      throw new Error(`Donor not found for ID code ${idCode}`);
    }

    const filters = {
      donor: donor.id,
    };

    if (idCode.length !== 11) {
      filters.companyCode = idCode;
    }

    const latestRecurringDonations = await strapi.entityService.findMany(
      "api::recurring-donation.recurring-donation",
      {
        filters,
        populate: [
          "organizationRecurringDonations",
          "organizationRecurringDonations.organization",
        ],
        sort: "datetime:desc",
        limit: 1,
      }
    );

    if (latestRecurringDonations.length === 0) {
      throw new Error("No recurring donations found");
    }

    const recurringDonation = latestRecurringDonations[0];

    const totalAmount = amount * 100;
    const tipSize = recurringDonation.tipSize;
    const tipAmount = Math.round(tipSize * totalAmount);
    const amountWithoutTip = totalAmount - tipAmount;

    const datetime = new Date(date);
    datetime.setHours(12, 0, 0, 0);

    const donation = await strapi.entityService.create(
      "api::donation.donation",
      {
        data: {
          donor: donor.id,
          recurringDonation: recurringDonation.id,
          amount: totalAmount,
          datetime,
          finalized: true,
          companyName: recurringDonation.companyName,
          companyCode: recurringDonation.companyCode,
          tipSize,
          tipAmount,
          iban,
          paymentMethod: recurringDonation.bank,
        },
      }
    );

    await strapi
      .service("api::organization-donation.organization-donation")
      .createFromOrganizationRecurringDonations({
        donationId: donation.id,
        donationAmount: amountWithoutTip,
        organizationRecurringDonations:
          recurringDonation.organizationRecurringDonations,
      });
  },

  async insertDonation(donationData) {
    const {
      organizationDonations,
      ...donationDataWithoutOrganizationDonations
    } = donationData;

    const donation = await strapi.entityService.create(
      "api::donation.donation",
      {
        data: donationDataWithoutOrganizationDonations,
      }
    );

    await strapi
      .service("api::organization-donation.organization-donation")
      .createFromArray({
        donationId: donation.id,
        donationAmount: donation.amount,
        organizationDonations,
      });
  },
}));
