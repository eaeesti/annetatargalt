"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const { amountToCents } = require("../../../utils/donation");
const { createRecurringPaymentLink } = require("../../../utils/banks");
const { createPaymentURL } = require("../../../utils/montonio");

module.exports = createCoreService("api::donation.donation", ({ strapi }) => ({
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
        },
      }
    );

    const payload = await strapi
      .service("api::donation.donation")
      .createMontonioPayload(donationEntry);
    const redirectURL = createPaymentURL(payload);
    return { redirectURL };
  },

  async createRecurringDonation({ donation, donor }) {
    await strapi.entityService.create(
      "api::recurring-donation.recurring-donation",
      {
        data: {
          amount: amountToCents(donation.amount),
          donor: donor.id,
          bank: donation.bank,
        },
      }
    );

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
