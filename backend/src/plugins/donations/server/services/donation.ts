import {
  amountToCents,
  validateIdCode,
  validateEmail,
  validateAmount,
} from "../../../../utils/donation";
import { createRecurringPaymentLink } from "../../../../utils/banks";
import { fetchRedirectUrl } from "../../../../utils/montonio";
import { formatEstonianAmount } from "../../../../utils/estonia";
import { format, textIntoParagraphs, sanitize } from "../../../../utils/string";
import { DonationsRepository } from "../../../../db/repositories/donations.repository";
import { OrganizationDonationsRepository } from "../../../../db/repositories/organization-donations.repository";
import { RecurringDonationsRepository } from "../../../../db/repositories/recurring-donations.repository";
import { OrganizationRecurringDonationsRepository } from "../../../../db/repositories/organization-recurring-donations.repository";
import {
  donorsRepository,
  donationsRepository,
  recurringDonationsRepository as recurringDonationsRepo2,
  organizationDonationsRepository,
  organizationRecurringDonationsRepository,
  donationTransfersRepository,
} from "../../../../db/repositories";
import { db } from "../../../../db/client";
import {
  organizationDonations as organizationDonationsTable,
  donations as donationsTable,
  organizationRecurringDonations as organizationRecurringDonationsTable,
  recurringDonations as recurringDonationsTable,
  donationTransfers as donationTransfersTable,
  donors as donorsTable,
} from "../../../../db/schema";
import { resizeOrganizationDonations } from "../../../../utils/donation";
import { DonorsRepository } from "../../../../db/repositories/donors.repository";
import { OrganizationRecurringDonationsRepository } from "../../../../db/repositories/organization-recurring-donations.repository";

const donationsRepo = new DonationsRepository();
const organizationDonationsRepo = new OrganizationDonationsRepository();
const recurringDonationsRepo = new RecurringDonationsRepository();
const organizationRecurringDonationsRepo =
  new OrganizationRecurringDonationsRepository();

export default ({ strapi }: any) => ({
  async validateDonation(donation: any) {
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

    for (const { organizationInternalId, amount } of donation.amounts) {
      if (amount <= 0) {
        return {
          valid: false,
          reason: `Invalid organization amount: ${amount}`,
        };
      }

      if (!organizationInternalId) {
        return {
          valid: false,
          reason: "organizationInternalId is required",
        };
      }

      const organizations = await strapi
        .documents("api::organization.organization")
        .findMany({
          filters: { internalId: organizationInternalId },
          fields: ["id", "active", "internalId"],
          limit: 1,
        });
      const organization = organizations[0];

      if (!organization || !organization.active) {
        return {
          valid: false,
          reason: `Not a valid organization: ${organizationInternalId}`,
        };
      }
    }

    const amountSum = donation.amounts.reduce(
      (acc: number, { amount }: any) => acc + amount,
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

  validateForeignDonation(donation: any) {
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
    donation: any,
    {
      paymentMethod = "paymentInitiation",
      currency = "EUR",
      customReturnUrl,
      externalDonation = false,
    }: {
      paymentMethod?: string;
      currency?: string;
      customReturnUrl?: string;
      externalDonation?: boolean;
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

    const payload = {
      merchantReference: `${merchantReferencePrefix} ${donation.id}`,
      returnUrl,
      notificationUrl: `${process.env.MONTONIO_RETURN_URL}/confirm`,
      grandTotal: amount,
      currency,
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

  async createDonation(donation: any, customReturnUrl?: string, externalDonation?: boolean) {
    const validation = await this.validateDonation(donation);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const donor = await strapi
      .plugin("donations")
      .service("donor")
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

  async createForeignDonation(donation: any) {
    const validation = await this.validateForeignDonation(donation);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const donor = await strapi
      .plugin("donations")
      .service("donor")
      .updateOrCreateDonorByEmail(donation);

    const donationEntry = await donationsRepo.create({
      donorId: donor.id,
      amount: donation.amount,
      datetime: new Date(),
      comment: "Foreign donation",
    });

    const global = await strapi.db.query("api::global.global").findOne();

    if (!global.tipOrganizationInternalId) {
      throw new Error("Tip organization internalId not configured");
    }

    const tipInternalId = global.tipOrganizationInternalId;

    await organizationDonationsRepo.create({
      donationId: donationEntry.id,
      organizationInternalId: tipInternalId,
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
  }: any) {
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

    const organizationDonationsData = donation.amounts.map(
      ({ organizationInternalId, amount }: any) => ({
        donationId: donationEntry.id,
        organizationInternalId,
        amount,
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

  async createRecurringDonation({ donation, donor, externalDonation }: any) {
    const recurringDonationEntry = await recurringDonationsRepo.create({
      donorId: donor.id,
      active: false,
      amount: donation.amount,
      bank: donation.bank,
      datetime: new Date(),
      companyName: donation.companyName,
      companyCode: donation.companyCode,
      comment: donation.comment,
    });

    const organizationRecurringDonationsData = donation.amounts.map(
      ({ organizationInternalId, amount }: any) => ({
        recurringDonationId: recurringDonationEntry.id,
        organizationInternalId,
        amount,
      })
    );

    await organizationRecurringDonationsRepo.createMany(
      organizationRecurringDonationsData
    );

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
    }, 3 * 60 * 1000);

    return { redirectURL: recurringPaymentLink };
  },

  async sendConfirmationEmail(donationId: number) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();

    const global = await strapi.db.query("api::global.global").findOne();

    const donation = await this.getDonationWithDetails(donationId);

    if (!donation) {
      throw new Error(`Donation ${donationId} not found`);
    }

    const template = {
      subject: emailConfig.confirmationSubject,
      text: emailConfig.confirmationText,
      html: emailConfig.confirmationHtml,
    };

    const data: any = {
      firstName: donation.donor.firstName,
      firstNameHtml: sanitize(donation.donor.firstName),
      lastName: donation.donor.lastName,
      lastNameHtml: sanitize(donation.donor.lastName),
      amount: formatEstonianAmount(donation.amount / 100),
      currency: global.currency,
    };

    data.summary = donation.organizationDonations
      .map((organizationDonation: any) => {
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

  async sendExternalConfirmationEmail(donationId: number) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();

    const global = await strapi.db.query("api::global.global").findOne();

    const donorsRepo2 = new DonorsRepository();

    const donation = await donationsRepo.findById(donationId);
    if (!donation) {
      throw new Error(`Donation ${donationId} not found`);
    }

    const donor = await donorsRepo2.findById(donation.donorId);
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

  async sendRecurringConfirmationEmail(recurringDonationId: number) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();

    const global = await strapi.db.query("api::global.global").findOne();

    const recurringDonation = await this.getRecurringDonationWithDetails(
      recurringDonationId
    );

    if (!recurringDonation) {
      throw new Error(`Recurring donation ${recurringDonationId} not found`);
    }

    const template = {
      subject: emailConfig.recurringConfirmationSubject,
      text: emailConfig.recurringConfirmationText,
      html: emailConfig.recurringConfirmationHtml,
    };

    const data: any = {
      firstName: recurringDonation.donor.firstName,
      firstNameHtml: sanitize(recurringDonation.donor.firstName),
      lastName: recurringDonation.donor.lastName,
      lastNameHtml: sanitize(recurringDonation.donor.lastName),
      amount: formatEstonianAmount(recurringDonation.amount / 100),
      currency: global.currency,
    };

    data.summary = recurringDonation.organizationRecurringDonations
      .map((organizationRecurringDonation: any) => {
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

  async sendExternalRecurringConfirmationEmail(recurringDonationId: number) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();
    const global = await strapi.db.query("api::global.global").findOne();

    const donorsRepo2 = new DonorsRepository();

    const recurringDonation = await recurringDonationsRepo.findById(
      recurringDonationId
    );
    if (!recurringDonation) {
      throw new Error(`Recurring donation ${recurringDonationId} not found`);
    }

    const donor = await donorsRepo2.findById(recurringDonation.donorId);
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

  async sendDedicationEmail(donationId: number) {
    const emailConfig = await strapi.db
      .query("api::email-config.email-config")
      .findOne();

    const global = await strapi.db.query("api::global.global").findOne();

    const donationWithDetails = await this.getDonationWithDetails(donationId);

    if (!donationWithDetails) {
      throw new Error(`Donation ${donationId} not found`);
    }

    const donation = await donationsRepo.findById(donationId);

    const template: any = {
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

    const data: any = {
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
      .map((organizationDonation: any) => {
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
  }: any) {
    const causeMap: Record<number, number> = {};
    for (const cause of causes) {
      const causeEntry = await strapi
        .service("api::cause.cause")
        .findOrCreateCause(cause);
      causeMap[cause.id] = causeEntry.id;
    }

    const organizationMap: Record<number, number> = {};
    const organizationInternalIdMap: Record<number, string> = {};
    for (const organization of organizations) {
      const organizationEntry = await strapi
        .service("api::organization.organization")
        .findOrCreateOrganization({
          ...organization,
          cause: organization.cause ? causeMap[organization.cause] : null,
        });
      organizationMap[organization.id] = organizationEntry.id;
      organizationInternalIdMap[organization.id] =
        organizationEntry.internalId;
    }

    const donorMap: Record<number, number> = {};
    for (const donor of donors) {
      const donorEntry = await strapi
        .plugin("donations")
        .service("donor")
        .findOrCreateDonor(donor);
      donorMap[donor.id] = donorEntry.id;
    }

    const recurringDonationMap: Record<number, number> = {};
    for (const recurringDonation of recurringDonations) {
      const recurringDonationEntry = await recurringDonationsRepo2.create({
        donorId: donorMap[recurringDonation.donor],
        active: recurringDonation.active ?? false,
        amount: recurringDonation.amount,
        bank: recurringDonation.bank,
        datetime: new Date(recurringDonation.datetime),
        companyName: recurringDonation.companyName,
        companyCode: recurringDonation.companyCode,
        comment: recurringDonation.comment,
      });
      recurringDonationMap[recurringDonation.id] = recurringDonationEntry.id;
    }

    for (const organizationRecurringDonation of organizationRecurringDonations) {
      await organizationRecurringDonationsRepository.create({
        recurringDonationId:
          recurringDonationMap[
            organizationRecurringDonation.recurringDonation
          ],
        organizationInternalId:
          organizationInternalIdMap[
            organizationRecurringDonation.organization
          ],
        amount: organizationRecurringDonation.amount,
      });
    }

    const donationMap: Record<number, number> = {};
    for (const donation of donations) {
      const donationEntry = await donationsRepository.create({
        donorId: donorMap[donation.donor],
        recurringDonationId: donation.recurringDonation
          ? recurringDonationMap[donation.recurringDonation]
          : null,
        amount: donation.amount,
        datetime: new Date(donation.datetime),
        finalized: donation.finalized ?? false,
        paymentMethod: donation.paymentMethod,
        iban: donation.iban,
        comment: donation.comment,
        companyName: donation.companyName,
        companyCode: donation.companyCode,
        dedicationName: donation.dedicationName,
        dedicationEmail: donation.dedicationEmail,
        dedicationMessage: donation.dedicationMessage,
        externalDonation: donation.externalDonation ?? false,
        sentToOrganization: donation.sentToOrganization ?? false,
      });

      donationMap[donation.id] = donationEntry.id;
    }

    for (const organizationDonation of organizationDonations) {
      await organizationDonationsRepository.create({
        donationId: donationMap[organizationDonation.donation],
        organizationInternalId:
          organizationInternalIdMap[organizationDonation.organization],
        amount: organizationDonation.amount,
      });
    }

    for (const donationTransfer of donationTransfers) {
      const transfer = await donationTransfersRepository.create({
        datetime: donationTransfer.datetime,
        recipient: donationTransfer.recipient,
        notes: donationTransfer.notes,
      });

      const donationIds = donationTransfer.donations.map(
        (donationId: number) => donationMap[donationId]
      );
      if (donationIds.length > 0) {
        await donationsRepository.addToTransfer(donationIds, transfer.id);
      }
    }
  },

  async export() {
    const causes = await strapi.documents("api::cause.cause").findMany({
      sort: "id",
    });

    const organizations = (
      await strapi.documents("api::organization.organization").findMany({
        sort: "id",
        populate: ["cause"],
      })
    ).map((organization: any) => ({
      ...organization,
      cause: organization.cause ? organization.cause.id : null,
    }));

    const donors = await donorsRepository.findAll();

    const recurringDonations = (
      await recurringDonationsRepo2.findAll()
    ).map((recurringDonation: any) => ({
      ...recurringDonation,
      donor: recurringDonation.donor ? recurringDonation.donor.id : null,
    }));

    const organizationRecurringDonations = (
      await organizationRecurringDonationsRepository.findAll()
    ).map((organizationRecurringDonation: any) => ({
      ...organizationRecurringDonation,
      recurringDonation: organizationRecurringDonation.recurringDonation
        ? organizationRecurringDonation.recurringDonation.id
        : null,
    }));

    const donations = (await donationsRepository.findAll()).map((donation: any) => ({
      ...donation,
      donor: donation.donor ? donation.donor.id : null,
      recurringDonation: donation.recurringDonationId,
      donationTransfer: donation.donationTransferId,
    }));

    const organizationDonations = (
      await organizationDonationsRepository.findAll()
    ).map((organizationDonation: any) => ({
      ...organizationDonation,
      donation: organizationDonation.donation
        ? organizationDonation.donation.id
        : null,
    }));

    const donationTransfers = (
      await donationTransfersRepository.findAll({ withDonations: true })
    ).map((donationTransfer: any) => ({
      ...donationTransfer,
      donations:
        donationTransfer.donations?.map((donation: any) => donation.id) || [],
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
    await db.delete(organizationDonationsTable);
    await db.delete(donationsTable);
    await db.delete(organizationRecurringDonationsTable);
    await db.delete(recurringDonationsTable);
    await db.delete(donationTransfersTable);
    await db.delete(donorsTable);
  },

  async sumOfFinalizedDonations() {
    const global = await strapi.db.query("api::global.global").findOne();

    const excludeInternalIds: string[] = [];

    if (global.tipOrganizationInternalId) {
      excludeInternalIds.push(global.tipOrganizationInternalId);
    }

    if (global.externalOrganizationInternalId) {
      excludeInternalIds.push(global.externalOrganizationInternalId);
    }

    return donationsRepository.sumFinalizedDonations({
      excludeOrganizationInternalIds: excludeInternalIds,
      externalDonation: false,
    });
  },

  async sumOfFinalizedCampaignDonations() {
    const global = await strapi.db.query("api::global.global").findOne();

    const excludeInternalIds: string[] = [];

    if (global.tipOrganizationInternalId) {
      excludeInternalIds.push(global.tipOrganizationInternalId);
    }

    if (global.externalOrganizationInternalId) {
      excludeInternalIds.push(global.externalOrganizationInternalId);
    }

    return donationsRepository.sumFinalizedDonationsInRange({
      dateFrom: "2025-12-08 00:00:00",
      dateTo: "2025-12-31 23:59:59",
      excludeOrganizationInternalIds: excludeInternalIds,
      externalDonation: false,
    });
  },

  async findTransactionDonation({ idCode, date, amount }: any) {
    const donor = await donorsRepository.findByIdCode(idCode);

    if (!donor) {
      throw new Error("Donor not found");
    }

    const noonUtc = new Date(`${date}T12:00:00.000Z`);
    const noonParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Tallinn",
      hour: "numeric",
      hour12: false,
    }).formatToParts(noonUtc);
    const tallinnNoonHour = parseInt(
      noonParts.find((p) => p.type === "hour")?.value ?? "0"
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

  async insertFromTransaction({ idCode, date, amount, iban }: any) {
    let donor = await strapi
      .plugin("donations")
      .service("donor")
      .findDonor(idCode);

    if (!donor) {
      throw new Error(`Donor not found for ID code ${idCode}`);
    }

    let latestRecurringDonations =
      await recurringDonationsRepo2.findByDonorId(donor.id);

    if (idCode.length !== 11) {
      latestRecurringDonations = latestRecurringDonations.filter(
        (rd: any) => rd.companyCode === idCode
      );
    }

    if (latestRecurringDonations.length === 0) {
      throw new Error("No recurring donations found");
    }

    const transactionDateLimit = new Date(date).getTime() + 24 * 60 * 60 * 1000;
    const recurringDonation = latestRecurringDonations.find(
      (rd: any) => new Date(rd.datetime).getTime() <= transactionDateLimit
    );

    if (!recurringDonation) {
      throw new Error("No recurring donation found for this date");
    }

    const organizationRecurringDonations =
      await organizationRecurringDonationsRepository.findByRecurringDonationId(
        recurringDonation.id
      );

    const datetime = new Date(date);
    datetime.setHours(12, 0, 0, 0);

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

    const donationAmount = Math.round(amount * 100);
    const donationMultiplier = donationAmount / recurringDonation.amount;

    const resizedOrganizationDonations = resizeOrganizationDonations(
      organizationRecurringDonations,
      donationMultiplier,
      donationAmount
    );

    const orgDonationsData = resizedOrganizationDonations.map(
      (orgRecurring: any) => ({
        donationId: donation.id,
        organizationInternalId: orgRecurring.organizationInternalId,
        amount: orgRecurring.amount,
      })
    );

    await organizationDonationsRepository.createMany(orgDonationsData);

    return donation;
  },

  async insertDonation(donationData: any) {
    const {
      organizationDonations,
      ...donationDataWithoutOrganizationDonations
    } = donationData;

    const donation = await donationsRepository.create({
      ...donationDataWithoutOrganizationDonations,
      datetime: donationDataWithoutOrganizationDonations.datetime
        ? new Date(donationDataWithoutOrganizationDonations.datetime)
        : new Date(),
    });

    const orgDonationsData: any[] = [];
    for (const orgDonation of organizationDonations) {
      let organizationInternalId = orgDonation.organizationInternalId;

      if (!organizationInternalId && orgDonation.organization) {
        const org = await strapi
          .documents("api::organization.organization")
          .findOne({
            documentId: orgDonation.organization,
            fields: ["internalId"],
          });
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

  async getDonationsInDateRange(startDate: string, endDate: string) {
    const allDonations = await donationsRepository.findByDateRange(
      startDate,
      endDate
    );

    return allDonations.filter((donation: any) => donation.finalized);
  },

  async addDonationsToTransfer(donationIds: number[], transferId: number) {
    await donationsRepository.addToTransfer(donationIds, transferId);
  },

  async getDonationWithDetails(donationId: number) {
    const donorsRepo2 = new DonorsRepository();

    const donation = await donationsRepo.findByIdWithRelations(donationId);

    if (!donation) {
      return null;
    }

    const donor = await donorsRepo2.findById(donation.donorId);

    const organizationDonations = await Promise.all(
      donation.organizationDonations.map(async (orgDonation: any) => {
        const organizations = await strapi
          .documents("api::organization.organization")
          .findMany({
            filters: { internalId: orgDonation.organizationInternalId },
            populate: ["cause"],
            limit: 1,
          });

        const organization = organizations[0] || null;

        return {
          id: orgDonation.id,
          amount: orgDonation.amount,
          organization,
        };
      })
    );

    return {
      id: donation.id,
      amount: donation.amount,
      donor,
      organizationDonations,
    };
  },

  async getRecurringDonationWithDetails(recurringDonationId: number) {
    const donorsRepo2 = new DonorsRepository();
    const orgRecurringDonationsRepo = new OrganizationRecurringDonationsRepository();

    const recurringDonation = await recurringDonationsRepo.findById(
      recurringDonationId
    );

    if (!recurringDonation) {
      return null;
    }

    const donor = await donorsRepo2.findById(recurringDonation.donorId);

    const organizationRecurringDonations =
      await orgRecurringDonationsRepo.findByRecurringDonationId(
        recurringDonationId
      );

    const organizationRecurringDonationsWithOrgs = await Promise.all(
      organizationRecurringDonations.map(async (orgRecurringDonation: any) => {
        const organizations = await strapi
          .documents("api::organization.organization")
          .findMany({
            filters: {
              internalId: orgRecurringDonation.organizationInternalId,
            },
            limit: 1,
          });

        const organization = organizations[0] || null;

        return {
          id: orgRecurringDonation.id,
          amount: orgRecurringDonation.amount,
          organization,
        };
      })
    );

    return {
      id: recurringDonation.id,
      amount: recurringDonation.amount,
      donor,
      organizationRecurringDonations: organizationRecurringDonationsWithOrgs,
    };
  },
});
