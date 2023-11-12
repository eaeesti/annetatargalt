"use strict";

/**
 * donation controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const { amountToCents, validateDonation } = require("../../../utils/donation");
const {
  createPaymentURL,
  decodePaymentToken,
} = require("../../../utils/montonio");

module.exports = createCoreController(
  "api::donation.donation",
  ({ strapi }) => ({
    async donate(ctx) {
      const donation = ctx.request.body;
      const validation = validateDonation(donation);

      if (!validation.valid) {
        return ctx.badRequest(validation.reason);
      }

      const donor = await strapi.service("api::donor.donor").findOrCreateDonor({
        firstName: donation.firstName,
        lastName: donation.lastName,
        email: donation.email,
        idCode: donation.idCode,
      });

      const donationEntry = await strapi.entityService.create(
        "api::donation.donation",
        {
          data: {
            amount: amountToCents(donation.amount),
            donor: donor.id,
          },
        }
      );

      if (donation.type === "recurring") {
        return ctx.send({ redirectURL: "/annetatud" });
      }

      const payload = await strapi
        .service("api::donation.donation")
        .createMontonioPayload(donationEntry);
      const paymentURL = createPaymentURL(payload);
      return ctx.send({ redirectURL: paymentURL });
    },

    async confirm(ctx) {
      const paymentToken = ctx.request.query.payment_token;

      if (!paymentToken) {
        return ctx.badRequest("No payment token provided");
      }

      let decoded;
      try {
        decoded = decodePaymentToken(paymentToken);
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Invalid payment token");
      }

      if (decoded.status !== "finalized") {
        return ctx.badRequest("Payment not finalized");
      }

      const id = Number(decoded.merchant_reference.split(" ")[1]);

      const donation = await strapi.entityService.findOne(
        "api::donation.donation",
        id
      );

      if (!donation) {
        return ctx.badRequest("Donation not found");
      }

      if (donation.finalized) {
        return ctx.badRequest("Donation already finalized");
      }

      try {
        await strapi.entityService.update("api::donation.donation", id, {
          data: {
            finalized: true,
            iban: decoded.customer_iban || "",
            paymentMethod: decoded.payment_method_name || "",
          },
        });
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Failed to update donation");
      }

      // TODO: Send confirmation email

      return ctx.send();
    },

    async decode(ctx) {
      const paymentToken = ctx.request.query.payment_token;

      if (!paymentToken) {
        return ctx.badRequest("No payment token provided");
      }

      let decoded;
      try {
        decoded = decodePaymentToken(paymentToken);
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Invalid payment token");
      }

      if (decoded.status !== "finalized") {
        return { success: false, reason: "Payment not finalized" };
      }

      const id = Number(decoded.merchant_reference.split(" ")[1]);

      const donation = await strapi.entityService.findOne(
        "api::donation.donation",
        id,
        { fields: ["amount"], populate: ["donor"] }
      );

      if (!donation) {
        return ctx.badRequest("Donation not found");
      }

      return ctx.send({ donation });
    },
  })
);
