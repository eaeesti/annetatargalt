"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const {
  amountToCents,
  validateIdCode,
  validateEmail,
  validateAmount,
} = require("../../../utils/donation");
const { createRecurringPaymentLink } = require("../../../utils/banks");
const { fetchRedirectUrl } = require("../../../utils/montonio");
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

    if (donation.amount >= 1500000) {
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

    if (donation.type === "onetime") {
      if (
        !["paymentInitiation", "cardPayments"].includes(donation.paymentMethod)
      ) {
        return {
          valid: false,
          reason: `Invalid payment method: ${donation.paymentMethod}`,
        };
      }
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

    for (let { organizationId } of donation.amounts) {
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

    const amountSum = donation.amounts.reduce(
      (acc, { amount }) => acc + amount,
      0
    );
    if (amountSum !== donation.amount) {
      return {
        valid: false,
        reason: "Organization amounts do not add up to the total amount",
      };
    }

    return { valid: true };
  },

  async createMontonioPayload(
    donation,
    {
      paymentMethod = "paymentInitiation",
      currency = "EUR",
      customReturnUrl,
      externalDonation = false,
    } = {}
  ) {
    const donationInfo = await strapi.db
      .query("api::donation-info.donation-info")
      .findOne();

    const amount = donation.amount / 100;

    const returnUrl = customReturnUrl
      ? customReturnUrl
      : `${process.env.FRONTEND_URL}/${donationInfo.returnPath}`;

    const merchantReferencePrefix = externalDonation
      ? donationInfo.externalMerchantReferencePrefix
      : donationInfo.merchantReferencePrefix;

    // https://docs.montonio.com/api/stargate/guides/orders#creating-an-order
    const payload = {
      merchantReference: `${merchantReferencePrefix} ${donation.id}`,
      returnUrl,
      notificationUrl: `${process.env.MONTONIO_RETURN_URL}/confirm`,
      grandTotal: amount,
      currency: currency,
      locale: "et",
      payment: {
        amount,
        currency,
        method: paymentMethod,
        methodOptions: {
          preferredCountry: "EE",
          preferredLocale: "et",
        },
      },
    };

    return payload;
  },

  async createDonation(donation, customReturnUrl, externalDonation) {
    const validation = await this.validateDonation(donation);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const donor = await strapi
      .service("api::donor.donor")
      .updateOrCreateDonor(donation);

    if (donation.type === "recurring") {
      try {
        const { redirectURL } = await this.createRecurringDonation({
          donation,
          donor,
          externalDonation,
        });

        return { redirectURL };
      } catch (error) {
        console.error(error);
        throw new Error("Failed to create recurring donation");
      }
    }

    try {
      const { redirectURL } = await this.createSingleDonation({
        donation,
        donor,
        customReturnUrl,
        externalDonation,
      });
      return { redirectURL };
    } catch (error) {
      console.error(error);
      throw new Error("Failed to create single donation");
    }
  },

  async createSingleDonation({
    donation,
    donor,
    customReturnUrl,
    externalDonation,
  }) {
    const donationEntry = await strapi.entityService.create(
      "api::donation.donation",
      {
        data: {
          amount: donation.amount,
          donor: donor.id,
          datetime: new Date(),
          companyName: donation.companyName,
          companyCode: donation.companyCode,
          dedicationName: donation.dedicationName,
          dedicationEmail: donation.dedicationEmail,
          dedicationMessage: donation.dedicationMessage,
          comment: donation.comment,
          externalDonation,
        },
      }
    );

    await strapi
      .service("api::organization-donation.organization-donation")
      .createOrganizationDonations({
        donationId: donationEntry.id,
        amounts: donation.amounts,
      });

    const payload = await this.createMontonioPayload(donationEntry, {
      paymentMethod: donation.paymentMethod,
      customReturnUrl,
      externalDonation,
    });
    const redirectURL = await fetchRedirectUrl(payload);

    return { redirectURL };
  },

  async createRecurringDonation({ donation, donor, externalDonation }) {
    const recurringDonationEntry = await strapi.entityService.create(
      "api::recurring-donation.recurring-donation",
      {
        data: {
          amount: donation.amount,
          donor: donor.id,
          bank: donation.bank,
          datetime: new Date(),
          companyName: donation.companyName,
          companyCode: donation.companyCode,
          comment: donation.comment,
        },
      }
    );

    await strapi
      .service(
        "api::organization-recurring-donation.organization-recurring-donation"
      )
      .createOrganizationDonations({
        recurringDonationId: recurringDonationEntry.id,
        amounts: donation.amounts,
      });

    const donationInfo = await strapi.db
      .query("api::donation-info.donation-info")
      .findOne();

    const description = externalDonation
      ? donationInfo.externalRecurringPaymentComment
      : donationInfo.recurringPaymentComment;

    const recurringPaymentLink =
      donation.bank === "other"
        ? ""
        : createRecurringPaymentLink(
            donation.bank,
            {
              iban: donationInfo.iban,
              recipient: donationInfo.recipient,
              description,
            },
            donation.amount / 100
          );

    setTimeout(() => {
      if (externalDonation) {
        this.sendExternalRecurringConfirmationEmail(recurringDonationEntry.id);
      } else {
        this.sendRecurringConfirmationEmail(recurringDonationEntry.id);
      }
    }, 3 * 60 * 1000); // 3 minutes

    return { redirectURL: recurringPaymentLink };
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
        fields: ["amount"],
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

    data.summary = donation.organizationDonations
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

  async sendExternalConfirmationEmail(donationId) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();

    const global = await strapi.db.query("api::global.global").findOne();

    const donation = await strapi.entityService.findOne(
      "api::donation.donation",
      donationId,
      { populate: ["donor"] }
    );

    const template = {
      subject: emailConfig.externalConfirmationSubject,
      text: emailConfig.externalConfirmationText,
      html: emailConfig.externalConfirmationHtml,
    };

    const data = {
      firstName: donation.donor.firstName,
      firstNameHtml: sanitize(donation.donor.firstName),
      lastName: donation.donor.lastName,
      lastNameHtml: sanitize(donation.donor.lastName),
      amount: formatEstonianAmount(donation.amount / 100),
      currency: global.currency,
    };

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

    data.summary = recurringDonation.organizationRecurringDonations
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

  async sendExternalRecurringConfirmationEmail(recurringDonationId) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();
    const global = await strapi.db.query("api::global.global").findOne();

    const recurringDonation = await strapi.entityService.findOne(
      "api::recurring-donation.recurring-donation",
      recurringDonationId,
      { populate: ["donor"] }
    );

    const template = {
      subject: emailConfig.externalRecurringConfirmationSubject,
      text: emailConfig.externalRecurringConfirmationText,
      html: emailConfig.externalRecurringConfirmationHtml,
    };

    const data = {
      firstName: recurringDonation.donor.firstName,
      firstNameHtml: sanitize(recurringDonation.donor.firstName),
      lastName: recurringDonation.donor.lastName,
      lastNameHtml: sanitize(recurringDonation.donor.lastName),
      amount: formatEstonianAmount(recurringDonation.amount / 100),
      currency: global.currency,
    };

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

    data.summary = donation.organizationDonations
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
    donationTransfers,
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
          },
        }
      );
    }

    for (let donationTransfer of donationTransfers) {
      await strapi.entityService.create(
        "api::donation-transfer.donation-transfer",
        {
          data: {
            donations: donationTransfer.donations.map(
              (donationId) => donationMap[donationId]
            ),
            datetime: donationTransfer.datetime,
            recipient: donationTransfer.recipient,
            notes: donationTransfer.notes,
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
        populate: ["donor", "recurringDonation", "donationTransfer"],
      })
    ).map((donation) => ({
      ...donation,
      donor: donation.donor.id,
      recurringDonation: donation.recurringDonation
        ? donation.recurringDonation.id
        : null,
      donationTransfer: donation.donationTransfer
        ? donation.donationTransfer.id
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

    const donationTransfers = (
      await strapi.entityService.findMany(
        "api::donation-transfer.donation-transfer",
        {
          sort: "id",
          populate: ["donations"],
        }
      )
    ).map((donationTransfer) => ({
      ...donationTransfer,
      donations: donationTransfer.donations.map((donation) => donation.id),
    }));

    return {
      causes,
      organizations,
      donors,
      recurringDonations,
      organizationRecurringDonations,
      donations,
      organizationDonations,
      donationTransfers,
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
          amount: Math.round(amount * 100),
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
    if (!validateIdCode(idCode)) {
      throw new Error(`Invalid ID code: ${idCode}`);
    }

    let donor = await strapi.service("api::donor.donor").findDonor(idCode);

    if (!donor) {
      throw new Error(`Donor not found for ID code ${idCode}`);
    }

    const latestRecurringDonations = await strapi.entityService.findMany(
      "api::recurring-donation.recurring-donation",
      {
        filters: {
          donor: donor.id,
        },
        populate: [
          "organizationRecurringDonations",
          "organizationRecurringDonations.organization",
        ],
        sort: "datetime:desc",
      }
    );

    if (latestRecurringDonations.length === 0) {
      throw new Error("No recurring donations found");
    }

    // Find the latest recurring donation that is before the date of the transaction
    // Add 24 hours because the recurring donation includes a time but the bank transaction only includes a date
    const recurringDonation = latestRecurringDonations.find(
      (recurringDonation) =>
        new Date(recurringDonation.datetime).getTime() <=
        new Date(date).getTime() + 24 * 60 * 60 * 1000
    );

    if (!recurringDonation) {
      throw new Error("No recurring donation found for this date");
    }

    const datetime = new Date(date);
    datetime.setHours(12, 0, 0, 0);

    const donation = await strapi.entityService.create(
      "api::donation.donation",
      {
        data: {
          donor: donor.id,
          recurringDonation: recurringDonation.id,
          amount: Math.round(amount * 100),
          datetime,
          finalized: true,
          companyName: recurringDonation.companyName,
          companyCode: recurringDonation.companyCode,
          iban,
          paymentMethod: recurringDonation.bank,
        },
      }
    );

    await strapi
      .service("api::organization-donation.organization-donation")
      .createFromOrganizationRecurringDonations({
        donationId: donation.id,
        donationAmount: Math.round(amount * 100),
        recurringDonationAmount: recurringDonation.amount,
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
        organizationDonations,
      });
  },

  /**
   * Migrate tips from fields in the donation model to OrganizationDonations to
   * our organization.
   *
   * Strapi supports database migrations, but they don't seem to work very well, so
   * we're doing this through an API endpoint.
   */
  async migrateTips() {
    const donations = await strapi.entityService.findMany(
      "api::donation.donation",
      {
        filters: {
          tipAmount: { $gt: 0 },
          finalized: true,
        },
        populate: ["donor"],
      }
    );

    const global = await strapi.db.query("api::global.global").findOne();
    const tipOrganizationId = global.tipOrganizationId;

    await Promise.all(
      donations.map(async (donation) => {
        await strapi.entityService.create(
          "api::organization-donation.organization-donation",
          {
            data: {
              donation: donation.id,
              organization: tipOrganizationId,
              amount: donation.tipAmount,
            },
          }
        );
      })
    );

    await Promise.all(
      donations.map(async (donation) => {
        await strapi.entityService.update(
          "api::donation.donation",
          donation.id,
          {
            data: {
              tipAmount: null,
            },
          }
        );
      })
    );

    return donations.length;
  },

  async migrateRecurringTips() {
    const recurringDonations = await strapi.entityService.findMany(
      "api::recurring-donation.recurring-donation",
      {
        filters: {
          tipAmount: { $gt: 0 },
        },
        populate: ["donor"],
      }
    );

    const global = await strapi.db.query("api::global.global").findOne();
    const tipOrganizationId = global.tipOrganizationId;

    await Promise.all(
      recurringDonations.map(async (recurringDonation) => {
        await strapi.entityService.create(
          "api::organization-recurring-donation.organization-recurring-donation",
          {
            data: {
              recurringDonation: recurringDonation.id,
              organization: tipOrganizationId,
              amount: recurringDonation.tipAmount,
            },
          }
        );
      })
    );

    await Promise.all(
      recurringDonations.map(async (recurringDonation) => {
        await strapi.entityService.update(
          "api::recurring-donation.recurring-donation",
          recurringDonation.id,
          {
            data: {
              tipAmount: null,
            },
          }
        );
      })
    );

    return recurringDonations.length;
  },

  async getDonationsInDateRange(startDate, endDate) {
    const donations = await strapi.entityService.findMany(
      "api::donation.donation",
      {
        filters: {
          datetime: {
            $gte: startDate,
            $lte: endDate,
          },
          finalized: true,
        },
        populate: ["donor"],
      }
    );

    return donations;
  },

  async addDonationsToTransfer(donationIds, transferId) {
    donationIds.forEach(async (donationId) => {
      await strapi.entityService.update("api::donation.donation", donationId, {
        data: {
          donationTransfer: transferId,
        },
      });
    });
  },
}));
