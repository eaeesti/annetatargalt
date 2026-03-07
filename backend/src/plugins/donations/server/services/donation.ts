import type { Core } from "@strapi/strapi";
import {
  validateIdCode,
  validateEmail,
  validateAmount,
  resizeOrganizationDonations,
} from "../../../../utils/donation";
import { createRecurringPaymentLink, type Bank } from "../../../../utils/banks";
import montonio from "../../../../utils/montonio";
import { formatEstonianAmount } from "../../../../utils/estonia";
import { format, textIntoParagraphs, sanitize } from "../../../../utils/string";
import type { Donor, NewDonation } from "../../../../db/schema";
import {
  donorsRepository,
  donationsRepository,
  recurringDonationsRepository,
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

// ─── Domain Types ────────────────────────────────────────────────────────────

interface OrgAmount {
  organizationInternalId: string;
  amount: number;
}

interface DonationInput {
  firstName: string;
  lastName: string;
  email: string;
  idCode?: string;
  amount: number;
  type: "recurring" | "onetime";
  paymentMethod?: string;
  bank?: string;
  companyName?: string | null;
  companyCode?: string | null;
  dedicationName?: string | null;
  dedicationEmail?: string | null;
  dedicationMessage?: string | null;
  comment?: string | null;
  amounts: OrgAmount[];
}

interface ForeignDonationInput {
  firstName: string;
  lastName: string;
  email: string;
  amount: number;
}

type ValidationResult = { valid: true } | { valid: false; reason: string };

interface ImportData {
  causes: Array<{ id: number; [key: string]: unknown }>;
  organizations: Array<{ id: number; cause?: number | null; [key: string]: unknown }>;
  donors: Array<{ id: number; [key: string]: unknown }>;
  recurringDonations: Array<{
    id: number;
    donor: number;
    active?: boolean;
    amount: number;
    bank: string;
    datetime: string;
    companyName?: string | null;
    companyCode?: string | null;
    comment?: string | null;
  }>;
  organizationRecurringDonations: Array<{
    recurringDonation: number;
    organization: number;
    amount: number;
  }>;
  donations: Array<{
    id: number;
    donor: number;
    recurringDonation?: number;
    amount: number;
    datetime: string;
    finalized?: boolean;
    paymentMethod?: string;
    iban?: string;
    comment?: string;
    companyName?: string;
    companyCode?: string;
    dedicationName?: string;
    dedicationEmail?: string;
    dedicationMessage?: string;
    externalDonation?: boolean;
    sentToOrganization?: boolean;
  }>;
  organizationDonations: Array<{
    donation: number;
    organization: number;
    amount: number;
  }>;
  donationTransfers: Array<{
    donations: number[];
    datetime: string;
    recipient?: string;
    notes?: string;
  }>;
}

type InsertDonationInput = NewDonation & {
  datetime?: string | Date;
  organizationDonations: Array<{
    organizationInternalId?: string;
    organization?: string;
    amount: number;
  }>;
};

// ─── Strapi Plugin Helpers ────────────────────────────────────────────────────

type EmailRecipient = { to: string | null; replyTo?: string | null };
type EmailTemplate = { subject: string | null; text?: string | null; html?: string | null };

function emailService(strapi: Core.Strapi) {
  return (
    strapi as unknown as {
      plugins: {
        email: {
          services: {
            email: {
              sendTemplatedEmail(
                recipient: EmailRecipient,
                template: EmailTemplate,
                data: Record<string, unknown>
              ): Promise<void>;
            };
          };
        };
      };
    }
  ).plugins.email.services.email;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async validateDonation(donation: DonationInput): Promise<ValidationResult> {
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
        !["paymentInitiation", "cardPayments"].includes(donation.paymentMethod ?? "")
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
      (acc, { amount }: OrgAmount) => acc + amount,
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

  validateForeignDonation(donation: ForeignDonationInput): ValidationResult {
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
    donation: { id: number; amount: number },
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
      .findOne() as Record<string, string>;

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

  async createDonation(donation: DonationInput, customReturnUrl?: string, externalDonation?: boolean) {
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

  async createForeignDonation(donation: ForeignDonationInput) {
    const validation = await this.validateForeignDonation(donation);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const donor = await strapi
      .plugin("donations")
      .service("donor")
      .updateOrCreateDonorByEmail(donation);

    const donationEntry = await donationsRepository.create({
      donorId: donor.id,
      amount: donation.amount,
      datetime: new Date(),
      comment: "Foreign donation",
    });

    const global = await strapi.db.query("api::global.global").findOne() as Record<string, string | null>;

    if (!global.tipOrganizationInternalId) {
      throw new Error("Tip organization internalId not configured");
    }

    const tipInternalId = global.tipOrganizationInternalId;

    await organizationDonationsRepository.create({
      donationId: donationEntry.id,
      organizationInternalId: tipInternalId,
      amount: donation.amount,
    });

    const payload = await this.createMontonioPayload(donationEntry, {
      paymentMethod: "cardPayments",
    });

    const redirectURL = await montonio.fetchRedirectUrl(payload);

    return { redirectURL };
  },

  async createSingleDonation({
    donation,
    donor,
    customReturnUrl,
    externalDonation,
  }: {
    donation: DonationInput;
    donor: Donor;
    customReturnUrl?: string;
    externalDonation?: boolean;
  }) {
    const donationEntry = await donationsRepository.create({
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
      ({ organizationInternalId, amount }: OrgAmount) => ({
        donationId: donationEntry.id,
        organizationInternalId,
        amount,
      })
    );

    await organizationDonationsRepository.createMany(organizationDonationsData);

    const payload = await this.createMontonioPayload(donationEntry, {
      paymentMethod: donation.paymentMethod,
      customReturnUrl,
      externalDonation,
    });
    const redirectURL = await montonio.fetchRedirectUrl(payload);

    return { redirectURL };
  },

  async createRecurringDonation({
    donation,
    donor,
    externalDonation,
  }: {
    donation: DonationInput;
    donor: Donor;
    externalDonation?: boolean;
  }) {
    const recurringDonationEntry = await recurringDonationsRepository.create({
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
      ({ organizationInternalId, amount }: OrgAmount) => ({
        recurringDonationId: recurringDonationEntry.id,
        organizationInternalId,
        amount,
      })
    );

    await organizationRecurringDonationsRepository.createMany(
      organizationRecurringDonationsData
    );

    const donationInfo = await strapi.db
      .query("api::donation-info.donation-info")
      .findOne() as Record<string, string>;

    const description = externalDonation
      ? donationInfo.externalRecurringPaymentComment
      : donationInfo.recurringPaymentComment;

    const recurringPaymentLink =
      donation.bank === "other" || !donation.bank
        ? ""
        : createRecurringPaymentLink(
            donation.bank as Bank,
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
      .findOne() as Record<string, string | null>;

    const global = await strapi.db.query("api::global.global").findOne() as Record<string, string | null>;

    const donation = await this.getDonationWithDetails(donationId);

    if (!donation) {
      throw new Error(`Donation ${donationId} not found`);
    }

    if (!donation.donor) {
      throw new Error(`Donation ${donationId} has no associated donor`);
    }

    const template = {
      subject: emailConfig.confirmationSubject,
      text: emailConfig.confirmationText,
      html: emailConfig.confirmationHtml,
    };

    const summary = donation.organizationDonations
      .map((organizationDonation) => {
        const organization = organizationDonation.organization;
        const amount = formatEstonianAmount(organizationDonation.amount / 100);
        return `${organization?.title}: ${amount}${global.currency}`;
      })
      .join("\n");

    const data = {
      firstName: donation.donor.firstName,
      firstNameHtml: sanitize(donation.donor.firstName ?? ""),
      lastName: donation.donor.lastName,
      lastNameHtml: sanitize(donation.donor.lastName ?? ""),
      amount: formatEstonianAmount(donation.amount / 100),
      currency: global.currency,
      summary,
    };

    await emailService(strapi).sendTemplatedEmail(
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
      .findOne() as Record<string, string | null>;

    const global = await strapi.db.query("api::global.global").findOne() as Record<string, string | null>;

    const donation = await donationsRepository.findById(donationId);
    if (!donation) {
      throw new Error(`Donation ${donationId} not found`);
    }

    if (!donation.donorId) {
      throw new Error(`Donation ${donationId} has no associated donor`);
    }

    const donor = await donorsRepository.findById(donation.donorId);
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
      firstNameHtml: sanitize(donor.firstName ?? ""),
      lastName: donor.lastName,
      lastNameHtml: sanitize(donor.lastName ?? ""),
      amount: formatEstonianAmount(donation.amount / 100),
      currency: global.currency,
    };

    await emailService(strapi).sendTemplatedEmail(
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
      .findOne() as Record<string, string | null>;

    const global = await strapi.db.query("api::global.global").findOne() as Record<string, string | null>;

    const recurringDonation = await this.getRecurringDonationWithDetails(
      recurringDonationId
    );

    if (!recurringDonation) {
      throw new Error(`Recurring donation ${recurringDonationId} not found`);
    }

    if (!recurringDonation.donor) {
      throw new Error(`Recurring donation ${recurringDonationId} has no associated donor`);
    }

    const template = {
      subject: emailConfig.recurringConfirmationSubject,
      text: emailConfig.recurringConfirmationText,
      html: emailConfig.recurringConfirmationHtml,
    };

    const summary = recurringDonation.organizationRecurringDonations
      .map((organizationRecurringDonation) => {
        const organization = organizationRecurringDonation.organization;
        const amount = formatEstonianAmount(
          organizationRecurringDonation.amount / 100
        );
        return `${organization?.title}: ${amount}${global.currency}`;
      })
      .join("\n");

    const data = {
      firstName: recurringDonation.donor.firstName,
      firstNameHtml: sanitize(recurringDonation.donor.firstName ?? ""),
      lastName: recurringDonation.donor.lastName,
      lastNameHtml: sanitize(recurringDonation.donor.lastName ?? ""),
      amount: formatEstonianAmount(recurringDonation.amount / 100),
      currency: global.currency,
      summary,
    };

    await emailService(strapi).sendTemplatedEmail(
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
      .findOne() as Record<string, string | null>;
    const global = await strapi.db.query("api::global.global").findOne() as Record<string, string | null>;

    const recurringDonation = await recurringDonationsRepository.findById(
      recurringDonationId
    );
    if (!recurringDonation) {
      throw new Error(`Recurring donation ${recurringDonationId} not found`);
    }

    const donor = await donorsRepository.findById(recurringDonation.donorId);
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
      firstNameHtml: sanitize(donor.firstName ?? ""),
      lastName: donor.lastName,
      lastNameHtml: sanitize(donor.lastName ?? ""),
      amount: formatEstonianAmount(recurringDonation.amount / 100),
      currency: global.currency,
    };

    await emailService(strapi).sendTemplatedEmail(
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
      .findOne() as Record<string, string | null>;

    const global = await strapi.db.query("api::global.global").findOne() as Record<string, string | null>;

    const donationWithDetails = await this.getDonationWithDetails(donationId);

    if (!donationWithDetails) {
      throw new Error(`Donation ${donationId} not found`);
    }

    if (!donationWithDetails.donor) {
      throw new Error(`Donation ${donationId} has no associated donor`);
    }

    const donation = await donationsRepository.findById(donationId);
    if (!donation) {
      throw new Error(`Donation ${donationId} not found`);
    }

    const template = {
      subject: emailConfig.dedicationSubject,
      text: format(emailConfig.dedicationText ?? "", {
        message: donation.dedicationMessage
          ? emailConfig.dedicationMessageText ?? ""
          : "",
      }),
      html: format(emailConfig.dedicationHtml ?? "", {
        messageHtml: donation.dedicationMessage
          ? emailConfig.dedicationMessageHtml ?? ""
          : "",
      }),
    };

    const donorName = `${donationWithDetails.donor.firstName} ${donationWithDetails.donor.lastName}`;
    const dedicationMessage = `"${donation.dedicationMessage}"`;
    const summary = donationWithDetails.organizationDonations
      .map((organizationDonation) => {
        const organization = organizationDonation.organization;
        const amount = formatEstonianAmount(organizationDonation.amount / 100);
        return `${organization?.title}: ${amount}${global.currency}`;
      })
      .join("\n");

    const data = {
      dedicationName: donation.dedicationName,
      donorName,
      amount: formatEstonianAmount(donation.amount / 100),
      currency: global.currency,
      dedicationMessage,
      dedicationNameHtml: sanitize(donation.dedicationName ?? ""),
      donorNameHtml: sanitize(donorName),
      dedicationMessageHtml: textIntoParagraphs(sanitize(dedicationMessage)),
      summary,
    };

    await emailService(strapi).sendTemplatedEmail(
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
  }: ImportData) {
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
        organizationEntry.internalId ?? "";
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
      const recurringDonationEntry = await recurringDonationsRepository.create({
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
    ).map((organization) => ({
      ...organization,
      cause: organization.cause ? (organization.cause as { id: number }).id : null,
    }));

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
    }));

    const donations = (await donationsRepository.findAll()).map((donation) => ({
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
    }));

    const donationTransfers = (
      await donationTransfersRepository.findAll({ withDonations: true })
    ).map((donationTransfer) => ({
      ...donationTransfer,
      donations:
        (donationTransfer as typeof donationTransfer & { donations?: Array<{ id: number }> })
          .donations?.map((donation) => donation.id) || [],
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
    const global = await strapi.db.query("api::global.global").findOne() as Record<string, string | null>;

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
    const global = await strapi.db.query("api::global.global").findOne() as Record<string, string | null>;

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

  async findTransactionDonation({ idCode, date, amount }: { idCode: string; date: string; amount: number }) {
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

  async insertFromTransaction({ idCode, date, amount, iban }: { idCode: string; date: string; amount: number; iban: string }) {
    let donor = await strapi
      .plugin("donations")
      .service("donor")
      .findDonor(idCode);

    if (!donor) {
      throw new Error(`Donor not found for ID code ${idCode}`);
    }

    let latestRecurringDonations =
      await recurringDonationsRepository.findByDonorId(donor.id);

    if (idCode.length !== 11) {
      latestRecurringDonations = latestRecurringDonations.filter(
        (rd) => rd.companyCode === idCode
      );
    }

    if (latestRecurringDonations.length === 0) {
      throw new Error("No recurring donations found");
    }

    const transactionDateLimit = new Date(date).getTime() + 24 * 60 * 60 * 1000;
    const recurringDonation = latestRecurringDonations.find(
      (rd) => new Date(rd.datetime).getTime() <= transactionDateLimit
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
      (orgRecurring) => ({
        donationId: donation.id,
        organizationInternalId: orgRecurring.organizationInternalId ?? "",
        amount: orgRecurring.amount,
      })
    );

    await organizationDonationsRepository.createMany(orgDonationsData);

    return donation;
  },

  async insertDonation({
    organizationDonations,
    ...donationFields
  }: InsertDonationInput) {
    const donation = await donationsRepository.create(donationFields);

    const orgDonationsData: Array<{ donationId: number; organizationInternalId: string; amount: number }> = [];
    for (const orgDonation of organizationDonations) {
      let organizationInternalId = orgDonation.organizationInternalId;

      if (!organizationInternalId && orgDonation.organization) {
        const org = await strapi
          .documents("api::organization.organization")
          .findOne({
            documentId: orgDonation.organization,
            fields: ["internalId"],
          });
        organizationInternalId = (org as { internalId: string } | null)?.internalId;
      }

      if (organizationInternalId) {
        orgDonationsData.push({
          donationId: donation.id,
          organizationInternalId,
          amount: orgDonation.amount,
        });
      }
    }

    await organizationDonationsRepository.createMany(orgDonationsData);

    return donation;
  },

  async getDonationsInDateRange(startDate: string, endDate: string) {
    const allDonations = await donationsRepository.findByDateRange(
      startDate,
      endDate
    );

    return allDonations.filter((donation) => donation.finalized);
  },

  async addDonationsToTransfer(donationIds: number[], transferId: number) {
    await donationsRepository.addToTransfer(donationIds, transferId);
  },

  async getDonationWithDetails(donationId: number) {
    const donation = await donationsRepository.findByIdWithRelations(donationId);

    if (!donation) {
      return null;
    }

    const donor = donation.donorId !== null
      ? await donorsRepository.findById(donation.donorId)
      : undefined;

    const organizationDonations = await Promise.all(
      donation.organizationDonations.map(async (orgDonation) => {
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
    const recurringDonation = await recurringDonationsRepository.findById(
      recurringDonationId
    );

    if (!recurringDonation) {
      return null;
    }

    const donor = await donorsRepository.findById(recurringDonation.donorId);

    const organizationRecurringDonations =
      await organizationRecurringDonationsRepository.findByRecurringDonationId(
        recurringDonationId
      );

    const organizationRecurringDonationsWithOrgs = await Promise.all(
      organizationRecurringDonations.map(async (orgRecurringDonation) => {
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
