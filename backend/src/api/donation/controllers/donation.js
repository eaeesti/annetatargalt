"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const { decodeOrderToken } = require("../../../utils/montonio");

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

      if (donation.type === "recurring") {
        try {
          const { redirectURL, recurringDonationId } = await strapi
            .service("api::donation.donation")
            .createRecurringDonation({ donation, donor });

          setTimeout(() => {
            strapi
              .service("api::donation.donation")
              .sendRecurringConfirmationEmail(recurringDonationId);
          }, 3 * 60 * 1000); // 3 minutes

          return ctx.send({ redirectURL });
        } catch (error) {
          console.error(error);
          return ctx.badRequest("Failed to create recurring donation");
        }
      }

      try {
        const { redirectURL } = await strapi
          .service("api::donation.donation")
          .createSingleDonation({ donation, donor });
        return ctx.send({ redirectURL });
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Failed to create single donation");
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
  })
);
