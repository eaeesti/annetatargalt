"use strict";

/**
 * donation service
 */

const { createCoreService } = require("@strapi/strapi").factories;

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
}));
