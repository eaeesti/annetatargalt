"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const { decodeOrderToken } = require("../../../utils/montonio");

module.exports = createCoreController(
  "api::donation.donation",
  ({ strapi }) => ({
    async donate(ctx) {
      const donation = ctx.request.body;

      try {
        const { redirectURL } = await strapi
          .service("api::donation.donation")
          .createDonation(donation);
        return ctx.send({ redirectURL });
      } catch (error) {
        return ctx.badRequest(error.message);
      }
    },

    async donateExternal(ctx) {
      const returnUrl = ctx.request.body.returnUrl;
      if (!returnUrl) {
        return ctx.badRequest("No return URL provided");
      }

      const global = await strapi.db.query("api::global.global").findOne();

      const donation = {
        ...ctx.request.body,
        comment: `Return URL: ${returnUrl}`,
        // External donations always go to the specified organization
        amounts: [
          {
            amount: ctx.request.body.amount,
            organizationId: global.externalOrganizationId,
          },
        ],
      };

      try {
        const { redirectURL } = await strapi
          .service("api::donation.donation")
          .createDonation(donation, returnUrl, true);
        return ctx.send({ redirectURL });
      } catch (error) {
        return ctx.badRequest(error.message);
      }
    },

    async confirm(ctx) {
      const orderToken = ctx.request.query["order-token"];

      if (!orderToken) {
        return ctx.badRequest("No order token provided");
      }

      let decoded;
      try {
        decoded = decodeOrderToken(orderToken);
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Invalid payment token");
      }

      if (decoded.paymentStatus !== "PAID") {
        return ctx.badRequest("Payment not paid");
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

      if (donation.externalDonation) {
        await strapi
          .service("api::donation.donation")
          .sendExternalConfirmationEmail(id);
      } else {
        await strapi
          .service("api::donation.donation")
          .sendConfirmationEmail(id);
      }

      if (donation.dedicationEmail) {
        await strapi.service("api::donation.donation").sendDedicationEmail(id);
      }

      return ctx.send();
    },

    async decode(ctx) {
      const orderToken = ctx.request.query["order-token"];

      if (!orderToken) {
        return ctx.badRequest("No payment token provided");
      }

      let decoded;
      try {
        decoded = decodeOrderToken(orderToken);
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Invalid payment token");
      }

      if (decoded.paymentStatus !== "PAID") {
        return ctx.badRequest("Payment not paid");
      }

      const id = Number(decoded.merchant_reference.split(" ").at(-1));

      const donation = await strapi.entityService.findOne(
        "api::donation.donation",
        id,
        {
          fields: ["amount"],
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

    async findTransaction(ctx) {
      const { idCode, amount, date } = ctx.request.query;

      let donation;
      try {
        donation = await strapi
          .service("api::donation.donation")
          .findTransactionDonation({ idCode, amount, date });
      } catch (error) {
        console.error(error);
        return ctx.badRequest(error.message);
      }

      return ctx.send({ donation });
    },

    async insertTransaction(ctx) {
      const { idCode, amount, date, iban } = ctx.request.body;

      await strapi.service("api::donation.donation").insertFromTransaction({
        idCode,
        amount,
        date,
        iban,
      });

      return ctx.send();
    },

    async insertDonation(ctx) {
      const donation = { ...ctx.request.body };
      await strapi.service("api::donation.donation").insertDonation(donation);

      return ctx.send();
    },

    async migrateTips(ctx) {
      const migratedCount = await strapi
        .service("api::donation.donation")
        .migrateTips();

      const migratedRecurringCount = await strapi
        .service("api::donation.donation")
        .migrateRecurringTips();

      return ctx.send({ migratedCount, migratedRecurringCount });
    },

    async addDonationsToTransferByDate(ctx) {
      const { startDate, endDate, transferId } = ctx.request.body;

      if (!startDate || !endDate || !transferId) {
        return ctx.badRequest(
          "Missing required fields (startDate, endDate, transferId)"
        );
      }

      const donations = await strapi
        .service("api::donation.donation")
        .getDonationsInDateRange(startDate, endDate);

      const donationIds = donations.map((donation) => donation.id);

      await strapi
        .service("api::donation.donation")
        .addDonationsToTransfer(donationIds, transferId);

      return ctx.send({
        message: `Added ${donationIds.length} donations to transfer ${transferId}`,
      });
    },
  })
);
