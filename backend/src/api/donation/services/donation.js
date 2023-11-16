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

  async createMontonioPayload(donation, { currency = "EUR" } = {}) {
    const donationInfo = await strapi.db
      .query("api::donation-info.donation-info")
      .findOne();

    const payload = {
      amount: donation.amount / 100,
      currency: currency,
      merchant_reference: `donation ${donation.id}`,
      merchant_return_url: `${process.env.FRONTEND_URL}/${donationInfo.returnPath}`,
      merchant_notification_url: `${process.env.MONTONIO_RETURN_URL}/confirm`,
      payment_information_unstructured: donationInfo.transactionComment,
      checkout_email: donation.email,
      checkout_first_name: donation.firstName,
      checkout_last_name: donation.lastName,
    };

    return payload;
  },

  async createSingleDonation({ donation, donor }) {
    const donationEntry = await strapi.entityService.create(
      "api::donation.donation",
      {
        data: {
          amount: amountToCents(donation.amount),
          donor: donor.id,
          datetime: new Date(),
        },
      }
    );

    await strapi
      .service("api::organization-donation.organization-donation")
      .createFromProportions(donationEntry, donation.proportions);

    const payload = await strapi
      .service("api::donation.donation")
      .createMontonioPayload(donationEntry);
    const redirectURL = createPaymentURL(payload);
    return { redirectURL };
  },

  async createRecurringDonation({ donation, donor }) {
    const recurringDonationEntry = await strapi.entityService.create(
      "api::recurring-donation.recurring-donation",
      {
        data: {
          amount: amountToCents(donation.amount),
          donor: donor.id,
          bank: donation.bank,
        },
      }
    );

    await strapi
      .service(
        "api::organization-recurring-donation.organization-recurring-donation"
      )
      .createFromProportions(recurringDonationEntry, donation.proportions);

    const donationInfo = await strapi.db
      .query("api::donation-info.donation-info")
      .findOne();

    try {
      const recurringPaymentLink = createRecurringPaymentLink(
        donation.bank,
        {
          iban: donationInfo.iban,
          recipient: donationInfo.recipient,
          description: donationInfo.recurringPaymentComment,
        },
        donation.amount
      );
      return { redirectURL: recurringPaymentLink };
    } catch (error) {
      return { redirectURL: "" };
    }
  },
}));
