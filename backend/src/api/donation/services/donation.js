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
const { DonationsRepository } = require("../../../db/repositories/donations.repository");
const { OrganizationDonationsRepository } = require("../../../db/repositories/organization-donations.repository");
const { RecurringDonationsRepository } = require("../../../db/repositories/recurring-donations.repository");
const { OrganizationRecurringDonationsRepository } = require("../../../db/repositories/organization-recurring-donations.repository");

const donationsRepo = new DonationsRepository();
const organizationDonationsRepo = new OrganizationDonationsRepository();
const recurringDonationsRepo = new RecurringDonationsRepository();
const organizationRecurringDonationsRepo = new OrganizationRecurringDonationsRepository();

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

    if (donation.idCode && !validateIdCode(donation.idCode)) {
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

    for (let { organizationId, amount } of donation.amounts) {
      if (amount <= 0) {
        return {
          valid: false,
          reason: `Invalid organization amount: ${amount}`,
        };
      }

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

  validateForeignDonation(donation) {
    if (!donation) {
      return { valid: false, reason: "No donation provided" };
    }

    if (!donation.firstName) {
      return { valid: false, reason: "No first name provided" };
    }

    if (!donation.lastName) {
      return { valid: false, reason: "No last name provided" };
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

  async createForeignDonation(donation) {
    const validation = await this.validateForeignDonation(donation);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const donor = await strapi
      .service("api::donor.donor")
      .updateOrCreateDonorByEmail(donation);

    // Create donation in Drizzle
    const donationEntry = await donationsRepo.create({
      donorId: donor.id,
      amount: donation.amount,
      datetime: new Date(),
      comment: "Foreign donation",
    });

    // Get tip organization from global settings
    const global = await strapi.db.query("api::global.global").findOne();
    const tipOrganization = await strapi.entityService.findOne(
      "api::organization.organization",
      global.tipOrganizationId,
      { fields: ["internalId"] }
    );

    if (!tipOrganization || !tipOrganization.internalId) {
      throw new Error("Tip organization not found or missing internalId");
    }

    // Create organization donation for tip organization
    await organizationDonationsRepo.create({
      donationId: donationEntry.id,
      organizationInternalId: tipOrganization.internalId,
      amount: donation.amount,
    });

    const payload = await this.createMontonioPayload(donationEntry, {
      paymentMethod: "cardPayments",
    });

    const redirectURL = await fetchRedirectUrl(payload);

    return { redirectURL };
  },

  async createSingleDonation({
    donation,
    donor,
    customReturnUrl,
    externalDonation,
  }) {
    // Create donation in Drizzle
    const donationEntry = await donationsRepo.create({
      donorId: donor.id,
      amount: donation.amount,
      datetime: new Date(),
      companyName: donation.companyName,
      companyCode: donation.companyCode,
      dedicationName: donation.dedicationName,
      dedicationEmail: donation.dedicationEmail,
      dedicationMessage: donation.dedicationMessage,
      comment: donation.comment,
      externalDonation: externalDonation || false,
    });

    // Map organization IDs to internal IDs and create organization donations
    const organizationDonationsData = await Promise.all(
      donation.amounts.map(async ({ organizationId, amount }) => {
        const organization = await strapi.entityService.findOne(
          "api::organization.organization",
          organizationId,
          { fields: ["internalId"] }
        );

        if (!organization || !organization.internalId) {
          throw new Error(`Organization ${organizationId} not found or missing internalId`);
        }

        return {
          donationId: donationEntry.id,
          organizationInternalId: organization.internalId,
          amount,
        };
      })
    );

    await organizationDonationsRepo.createMany(organizationDonationsData);

    const payload = await this.createMontonioPayload(donationEntry, {
      paymentMethod: donation.paymentMethod,
      customReturnUrl,
      externalDonation,
    });
    const redirectURL = await fetchRedirectUrl(payload);

    return { redirectURL };
  },

  async createRecurringDonation({ donation, donor, externalDonation }) {
    // Create recurring donation in Drizzle
    const recurringDonationEntry = await recurringDonationsRepo.create({
      donorId: donor.id,
      amount: donation.amount,
      bank: donation.bank,
      datetime: new Date(),
      companyName: donation.companyName,
      companyCode: donation.companyCode,
      comment: donation.comment,
    });

    // Map organization IDs to internal IDs and create organization recurring donations
    const organizationRecurringDonationsData = await Promise.all(
      donation.amounts.map(async ({ organizationId, amount }) => {
        const organization = await strapi.entityService.findOne(
          "api::organization.organization",
          organizationId,
          { fields: ["internalId"] }
        );

        if (!organization || !organization.internalId) {
          throw new Error(`Organization ${organizationId} not found or missing internalId`);
        }

        return {
          recurringDonationId: recurringDonationEntry.id,
          organizationInternalId: organization.internalId,
          amount,
        };
      })
    );

    await organizationRecurringDonationsRepo.createMany(organizationRecurringDonationsData);

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

    // Fetch donation with details using Drizzle + Strapi cross-system query
    const donation = await this.getDonationWithDetails(donationId);

    if (!donation) {
      throw new Error(`Donation ${donationId} not found`);
    }

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

    const { DonorsRepository } = require("../../../db/repositories/donors.repository");
    const donorsRepo = new DonorsRepository();

    // Fetch donation and donor from Drizzle
    const donation = await donationsRepo.findById(donationId);
    if (!donation) {
      throw new Error(`Donation ${donationId} not found`);
    }

    const donor = await donorsRepo.findById(donation.donorId);
    if (!donor) {
      throw new Error(`Donor ${donation.donorId} not found`);
    }

    const template = {
      subject: emailConfig.externalConfirmationSubject,
      text: emailConfig.externalConfirmationText,
      html: emailConfig.externalConfirmationHtml,
    };

    const data = {
      firstName: donor.firstName,
      firstNameHtml: sanitize(donor.firstName),
      lastName: donor.lastName,
      lastNameHtml: sanitize(donor.lastName),
      amount: formatEstonianAmount(donation.amount / 100),
      currency: global.currency,
    };

    await strapi.plugins["email"].services.email.sendTemplatedEmail(
      {
        to: donor.email,
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

    // Fetch recurring donation with details using Drizzle + Strapi cross-system query
    const recurringDonation = await this.getRecurringDonationWithDetails(recurringDonationId);

    if (!recurringDonation) {
      throw new Error(`Recurring donation ${recurringDonationId} not found`);
    }

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

    const { DonorsRepository } = require("../../../db/repositories/donors.repository");
    const donorsRepo = new DonorsRepository();

    // Fetch recurring donation and donor from Drizzle
    const recurringDonation = await recurringDonationsRepo.findById(recurringDonationId);
    if (!recurringDonation) {
      throw new Error(`Recurring donation ${recurringDonationId} not found`);
    }

    const donor = await donorsRepo.findById(recurringDonation.donorId);
    if (!donor) {
      throw new Error(`Donor ${recurringDonation.donorId} not found`);
    }

    const template = {
      subject: emailConfig.externalRecurringConfirmationSubject,
      text: emailConfig.externalRecurringConfirmationText,
      html: emailConfig.externalRecurringConfirmationHtml,
    };

    const data = {
      firstName: donor.firstName,
      firstNameHtml: sanitize(donor.firstName),
      lastName: donor.lastName,
      lastNameHtml: sanitize(donor.lastName),
      amount: formatEstonianAmount(recurringDonation.amount / 100),
      currency: global.currency,
    };

    await strapi.plugins["email"].services.email.sendTemplatedEmail(
      {
        to: donor.email,
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

    // Fetch donation with details using Drizzle + Strapi cross-system query
    const donationWithDetails = await this.getDonationWithDetails(donationId);

    if (!donationWithDetails) {
      throw new Error(`Donation ${donationId} not found`);
    }

    // Fetch full donation to get dedication fields
    const donation = await donationsRepo.findById(donationId);

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
      donorName: `${donationWithDetails.donor.firstName} ${donationWithDetails.donor.lastName}`,
      amount: formatEstonianAmount(donation.amount / 100),
      currency: global.currency,
      dedicationMessage: `"${donation.dedicationMessage}"`,
    };

    data.dedicationNameHtml = sanitize(data.dedicationName);
    data.donorNameHtml = sanitize(data.donorName);
    data.dedicationMessageHtml = textIntoParagraphs(
      sanitize(data.dedicationMessage)
    );

    data.summary = donationWithDetails.organizationDonations
      .map((organizationDonation) => {
        const organization = organizationDonation.organization;
        const amount = formatEstonianAmount(organizationDonation.amount / 100);
        return `${organization.title}: ${amount}${global.currency}`;
      })
      .join("\n");

    await strapi.plugins["email"].services.email.sendTemplatedEmail(
      {
        to: donation.dedicationEmail,
        replyTo: donationWithDetails.donor.email,
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
    const {
      donorsRepository,
      donationsRepository,
      recurringDonationsRepository,
      organizationDonationsRepository,
      organizationRecurringDonationsRepository,
      donationTransfersRepository,
    } = require("../../../db/repositories");

    // Causes and organizations stay in Strapi (content)
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

    // Donation data comes from Drizzle
    const donors = await donorsRepository.findAll();

    const recurringDonations = (
      await recurringDonationsRepository.findAll()
    ).map((recurringDonation) => ({
      ...recurringDonation,
      donor: recurringDonation.donor ? recurringDonation.donor.id : null,
    }));

    const organizationRecurringDonations = (
      await organizationRecurringDonationsRepository.findAll()
    ).map((organizationRecurringDonation) => ({
      ...organizationRecurringDonation,
      recurringDonation: organizationRecurringDonation.recurringDonation
        ? organizationRecurringDonation.recurringDonation.id
        : null,
      // organizationInternalId is already in the spread
    }));

    const donations = (
      await donationsRepository.findAll()
    ).map((donation) => ({
      ...donation,
      donor: donation.donor ? donation.donor.id : null,
      recurringDonation: donation.recurringDonationId,
      donationTransfer: donation.donationTransferId,
    }));

    const organizationDonations = (
      await organizationDonationsRepository.findAll()
    ).map((organizationDonation) => ({
      ...organizationDonation,
      donation: organizationDonation.donation
        ? organizationDonation.donation.id
        : null,
      // organizationInternalId is already in the spread
    }));

    const donationTransfers = (
      await donationTransfersRepository.findAll({ withDonations: true })
    ).map((donationTransfer) => ({
      ...donationTransfer,
      donations: donationTransfer.donations?.map((donation) => donation.id) || [],
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
    const { db } = require("../../../db/client");
    const {
      organizationDonations,
      donations,
      organizationRecurringDonations,
      recurringDonations,
      donationTransfers,
      donors,
    } = require("../../../db/schema");

    // Delete in FK-safe order: dependents before parents
    await db.delete(organizationDonations);
    await db.delete(donations);
    await db.delete(organizationRecurringDonations);
    await db.delete(recurringDonations);
    await db.delete(donationTransfers);
    await db.delete(donors);
  },

  async sumOfFinalizedDonations() {
    const { donationsRepository } = require("../../../db/repositories");
    const global = await strapi.db.query("api::global.global").findOne();

    // Get organization internalIds for tip and external organizations
    const tipOrg = await strapi.entityService.findOne(
      "api::organization.organization",
      global.tipOrganizationId,
      { fields: ["internalId"] }
    );

    const externalOrg = await strapi.entityService.findOne(
      "api::organization.organization",
      global.externalOrganizationId,
      { fields: ["internalId"] }
    );

    // Build list of organizations to exclude
    const excludeInternalIds = [];
    if (tipOrg?.internalId) excludeInternalIds.push(tipOrg.internalId);
    if (externalOrg?.internalId) excludeInternalIds.push(externalOrg.internalId);

    // Sum using Drizzle repository
    const totalAmount = await donationsRepository.sumFinalizedDonations({
      excludeOrganizationInternalIds: excludeInternalIds,
      externalDonation: false,
    });

    return totalAmount;
  },

  async sumOfFinalizedCampaignDonations() {
    const { donationsRepository } = require("../../../db/repositories");
    const global = await strapi.db.query("api::global.global").findOne();

    // Get organization internalIds for tip and external organizations
    const tipOrg = await strapi.entityService.findOne(
      "api::organization.organization",
      global.tipOrganizationId,
      { fields: ["internalId"] }
    );

    const externalOrg = await strapi.entityService.findOne(
      "api::organization.organization",
      global.externalOrganizationId,
      { fields: ["internalId"] }
    );

    // Build list of organizations to exclude
    const excludeInternalIds = [];
    if (tipOrg?.internalId) excludeInternalIds.push(tipOrg.internalId);
    if (externalOrg?.internalId) excludeInternalIds.push(externalOrg.internalId);

    // Sum using Drizzle repository with date range
    const totalAmount = await donationsRepository.sumFinalizedDonationsInRange({
      dateFrom: '2025-12-08 00:00:00',
      dateTo: '2025-12-31 23:59:59',
      excludeOrganizationInternalIds: excludeInternalIds,
      externalDonation: false,
    });

    return totalAmount;
  },

  async findTransactionDonation({ idCode, date, amount }) {
    const { donorsRepository, donationsRepository } = require("../../../db/repositories");

    const donor = await donorsRepository.findByIdCode(idCode);

    if (!donor) {
      throw new Error("Donor not found");
    }

    // Determine the UTC offset for Europe/Tallinn on this date (EET=+2, EEST=+3).
    // Formatting UTC noon to Tallinn local time gives hour 14 (EET) or 15 (EEST),
    // so offset = tallinnNoonHour - 12.
    const noonUtc = new Date(`${date}T12:00:00.000Z`);
    const noonParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Tallinn",
      hour: "numeric",
      hour12: false,
    }).formatToParts(noonUtc);
    const tallinnNoonHour = parseInt(
      noonParts.find((p) => p.type === "hour")?.value
    );
    const offsetMs = (tallinnNoonHour - 12) * 3600 * 1000;

    const startDate = new Date(
      new Date(`${date}T00:00:00.000Z`).getTime() - offsetMs
    );
    const endDate = new Date(
      new Date(`${date}T23:59:59.999Z`).getTime() - offsetMs
    );

    const donations = await donationsRepository.findByTransaction({
      idCode,
      amount: Math.round(amount * 100),
      dateFrom: startDate,
      dateTo: endDate,
    });

    if (donations.length === 0) {
      return null;
    }

    if (donations.length > 1) {
      throw new Error("Multiple donations found");
    }

    return donations[0];
  },

  async insertFromTransaction({ idCode, date, amount, iban }) {
    const {
      donationsRepository,
      recurringDonationsRepository,
      organizationDonationsRepository,
      organizationRecurringDonationsRepository,
    } = require("../../../db/repositories");
    const { resizeOrganizationDonations } = require("../../../utils/donation");

    // Find donor (still using Strapi donor service for now)
    let donor = await strapi.service("api::donor.donor").findDonor(idCode);

    if (!donor) {
      throw new Error(`Donor not found for ID code ${idCode}`);
    }

    // Find recurring donations by donor ID from Drizzle
    let latestRecurringDonations = await recurringDonationsRepository.findByDonorId(donor.id);

    // Filter by company code if idCode is not a personal ID (11 chars)
    if (idCode.length !== 11) {
      latestRecurringDonations = latestRecurringDonations.filter(
        (rd) => rd.companyCode === idCode
      );
    }

    if (latestRecurringDonations.length === 0) {
      throw new Error("No recurring donations found");
    }

    // Find the latest recurring donation that is before the date of the transaction
    // Add 24 hours because the recurring donation includes a time but the bank transaction only includes a date
    const transactionDateLimit = new Date(date).getTime() + 24 * 60 * 60 * 1000;
    const recurringDonation = latestRecurringDonations.find(
      (rd) => new Date(rd.datetime).getTime() <= transactionDateLimit
    );

    if (!recurringDonation) {
      throw new Error("No recurring donation found for this date");
    }

    // Get organization recurring donations for this template
    const organizationRecurringDonations =
      await organizationRecurringDonationsRepository.findByRecurringDonationId(
        recurringDonation.id
      );

    const datetime = new Date(date);
    datetime.setHours(12, 0, 0, 0);

    // Create donation in Drizzle
    const donation = await donationsRepository.create({
      donorId: donor.id,
      recurringDonationId: recurringDonation.id,
      amount: Math.round(amount * 100),
      datetime,
      finalized: true,
      companyName: recurringDonation.companyName,
      companyCode: recurringDonation.companyCode,
      iban,
      paymentMethod: recurringDonation.bank,
    });

    // Resize organization donations based on actual amount
    const donationAmount = Math.round(amount * 100);
    const donationMultiplier = donationAmount / recurringDonation.amount;

    const resizedOrganizationDonations = resizeOrganizationDonations(
      organizationRecurringDonations,
      donationMultiplier,
      donationAmount
    );

    // Create organization donations
    const orgDonationsData = resizedOrganizationDonations.map((orgRecurring) => ({
      donationId: donation.id,
      organizationInternalId: orgRecurring.organizationInternalId,
      amount: orgRecurring.amount,
    }));

    await organizationDonationsRepository.createMany(orgDonationsData);

    return donation;
  },

  async insertDonation(donationData) {
    const {
      donationsRepository,
      organizationDonationsRepository,
    } = require("../../../db/repositories");

    const {
      organizationDonations,
      ...donationDataWithoutOrganizationDonations
    } = donationData;

    // Create donation in Drizzle
    const donation = await donationsRepository.create({
      ...donationDataWithoutOrganizationDonations,
      // Ensure datetime is a Date object
      datetime: donationDataWithoutOrganizationDonations.datetime
        ? new Date(donationDataWithoutOrganizationDonations.datetime)
        : new Date(),
    });

    // Create organization donations
    // Handle both old format (organization: numeric ID) and new format (organizationInternalId: string)
    const orgDonationsData = [];
    for (const orgDonation of organizationDonations) {
      let organizationInternalId = orgDonation.organizationInternalId;

      // If organizationInternalId is not provided, convert from numeric organization ID
      if (!organizationInternalId && orgDonation.organization) {
        const org = await strapi.entityService.findOne(
          "api::organization.organization",
          orgDonation.organization,
          { fields: ["internalId"] }
        );
        organizationInternalId = org.internalId;
      }

      orgDonationsData.push({
        donationId: donation.id,
        organizationInternalId,
        amount: orgDonation.amount,
      });
    }

    await organizationDonationsRepository.createMany(orgDonationsData);

    return donation;
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
    const { donationsRepository } = require("../../../db/repositories");

    // Get donations in date range from Drizzle
    const allDonations = await donationsRepository.findByDateRange(startDate, endDate);

    // Filter for finalized donations only (matching original behavior)
    const donations = allDonations.filter((donation) => donation.finalized);

    return donations;
  },

  async addDonationsToTransfer(donationIds, transferId) {
    const { donationsRepository } = require("../../../db/repositories");

    // Use repository's batch update method (more efficient than forEach)
    await donationsRepository.addToTransfer(donationIds, transferId);
  },

  /**
   * Get donation with full details (donor, organizations with causes)
   * Used for thank-you page after payment
   */
  async getDonationWithDetails(donationId) {
    const { DonorsRepository } = require("../../../db/repositories/donors.repository");
    const donorsRepo = new DonorsRepository();

    // Fetch donation with organization donations from Drizzle
    const donation = await donationsRepo.findByIdWithRelations(donationId);

    if (!donation) {
      return null;
    }

    // Fetch donor details from Drizzle
    const donor = await donorsRepo.findById(donation.donorId);

    // Fetch organization details from Strapi for each organizationDonation
    const organizationDonations = await Promise.all(
      donation.organizationDonations.map(async (orgDonation) => {
        // Fetch organization from Strapi
        const organizations = await strapi.entityService.findMany(
          "api::organization.organization",
          {
            filters: { internalId: orgDonation.organizationInternalId },
            populate: ["cause"],
            limit: 1,
          }
        );

        const organization = organizations[0] || null;

        return {
          id: orgDonation.id,
          amount: orgDonation.amount,
          organization,
        };
      })
    );

    // Return in format matching old Strapi response
    return {
      id: donation.id,
      amount: donation.amount,
      donor,
      organizationDonations,
    };
  },

  /**
   * Get recurring donation with full details (donor, organizations)
   * Used for recurring donation confirmation emails
   */
  async getRecurringDonationWithDetails(recurringDonationId) {
    const { DonorsRepository } = require("../../../db/repositories/donors.repository");
    const { OrganizationRecurringDonationsRepository } = require("../../../db/repositories/organization-recurring-donations.repository");

    const donorsRepo = new DonorsRepository();
    const orgRecurringDonationsRepo = new OrganizationRecurringDonationsRepository();

    // Fetch recurring donation from Drizzle
    const recurringDonation = await recurringDonationsRepo.findById(recurringDonationId);

    if (!recurringDonation) {
      return null;
    }

    // Fetch donor details from Drizzle
    const donor = await donorsRepo.findById(recurringDonation.donorId);

    // Fetch organization recurring donations from Drizzle
    const organizationRecurringDonations = await orgRecurringDonationsRepo.findByRecurringDonationId(recurringDonationId);

    // Fetch organization details from Strapi for each organizationRecurringDonation
    const organizationRecurringDonationsWithOrgs = await Promise.all(
      organizationRecurringDonations.map(async (orgRecurringDonation) => {
        // Fetch organization from Strapi
        const organizations = await strapi.entityService.findMany(
          "api::organization.organization",
          {
            filters: { internalId: orgRecurringDonation.organizationInternalId },
            limit: 1,
          }
        );

        const organization = organizations[0] || null;

        return {
          id: orgRecurringDonation.id,
          amount: orgRecurringDonation.amount,
          organization,
        };
      })
    );

    // Return in format matching old Strapi response
    return {
      id: recurringDonation.id,
      amount: recurringDonation.amount,
      donor,
      organizationRecurringDonations: organizationRecurringDonationsWithOrgs,
    };
  },
}));
