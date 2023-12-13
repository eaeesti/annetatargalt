"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const { decodePaymentToken } = require("../../../utils/montonio");

module.exports = createCoreController(
  "api::donation.donation",
  ({ strapi }) => ({
    async donate(ctx) {
      const donation = ctx.request.body;
      const validation = await strapi
        .service("api::donation.donation")
        .validateDonation(donation);

      if (!validation.valid) {
        return ctx.badRequest(validation.reason);
      }

      const donor = await strapi
        .service("api::donor.donor")
        .updateOrCreateDonor(donation);

      const tipSize = donation.addTip ? 0.05 : 0;
      const tipAmount = Math.round(donation.amount * tipSize * 100) / 100;
      const totalAmount = Math.round((donation.amount + tipAmount) * 100) / 100;
      const calculations = { tipSize, tipAmount, totalAmount };

      if (donation.type === "recurring") {
        try {
          const { redirectURL } = await strapi
            .service("api::donation.donation")
            .createRecurringDonation({ donation, donor, calculations });
          return ctx.send({ redirectURL });
        } catch (error) {
          console.error(error);
          return ctx.badRequest("Failed to create recurring donation");
        }
      }

      try {
        const { redirectURL } = await strapi
          .service("api::donation.donation")
          .createSingleDonation({ donation, donor, calculations });
        return ctx.send({ redirectURL });
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Failed to create single donation");
      }
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

      const id = Number(decoded.merchant_reference.split(" ").at(-1));

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

      await strapi.service("api::donation.donation").sendConfirmationEmail(id);

      if (donation.dedicationEmail) {
        await strapi.service("api::donation.donation").sendDedicationEmail(id);
      }

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

      const id = Number(decoded.merchant_reference.split(" ").at(-1));

      const donation = await strapi.entityService.findOne(
        "api::donation.donation",
        id,
        {
          fields: ["amount", "tipAmount"],
          populate: [
            "donor",
            "organizationDonations",
            "organizationDonations.organization",
            "organizationDonations.organization.cause",
          ],
        }
      );

      if (!donation) {
        return ctx.badRequest("Donation not found");
      }

      return ctx.send({ donation });
    },

    async import(ctx) {
      const fullData = ctx.request.body;

      await strapi.service("api::donation.donation").import(fullData);

      return ctx.send();
    },

    async export(ctx) {
      const fullData = await strapi.service("api::donation.donation").export();

      return ctx.send(fullData);
    },

    async deleteAll(ctx) {
      const confirmation = ctx.request.body.confirmation;

      const currentDateTime = new Date().toISOString().slice(0, 16);

      if (confirmation !== currentDateTime) {
        return ctx.badRequest(
          `Confirmation must be the current date and time in the format 'YYYY-MM-DDTHH:MM' (${currentDateTime}). Instead got: '${confirmation}'`
        );
      }

      await strapi.service("api::donation.donation").deleteAll();

      return ctx.send();
    },

    async stats(ctx) {
      // let donorCount;
      // try {
      //   donorCount = await strapi
      //     .service("api::donor.donor")
      //     .donorsWithFinalizedDonationCount();
      // } catch (error) {
      //   console.error(error);
      //   return ctx.badRequest("Failed to get donor count");
      // }

      let donationSum;
      try {
        donationSum = await strapi
          .service("api::donation.donation")
          .sumOfFinalizedDonations();
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Failed to get donation count");
      }

      let campaignSum;
      try {
        campaignSum = await strapi
          .service("api::donation.donation")
          .sumOfFinalizedCampaignDonations();
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Failed to get campaign donation count");
      }

      return ctx.send({
        // donorCount,
        donationSum,
        campaignSum,
      });
    },
  })
);
