"use strict";

const { decodeOrderToken } = require("../../../../utils/montonio");
const {
  DonationsRepository,
} = require("../../../../db/repositories/donations.repository");

const donationsRepo = new DonationsRepository();

module.exports = ({ strapi }) => ({
  async donate(ctx) {
    const donation = ctx.request.body;

    try {
      const { redirectURL } = await strapi
        .plugin("donations").service("donation")
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

    const globalConfig = await strapi.db.query("api::global.global").findOne();

    const donation = {
      ...ctx.request.body,
      comment: `Return URL: ${returnUrl}`,
      // External donations always go to the specified organization
      amounts: [
        {
          amount: ctx.request.body.amount,
          organizationId: globalConfig.externalOrganizationId,
        },
      ],
    };

    try {
      const { redirectURL } = await strapi
        .plugin("donations").service("donation")
        .createDonation(donation, returnUrl, true);
      return ctx.send({ redirectURL });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  async donateForeign(ctx) {
    const donation = ctx.request.body;

    try {
      const { redirectURL } = await strapi
        .plugin("donations").service("donation")
        .createForeignDonation(donation);
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

    // Find donation using Drizzle
    const donation = await donationsRepo.findById(id);

    if (!donation) {
      return ctx.badRequest("Donation not found");
    }

    if (donation.finalized) {
      return ctx.badRequest("Donation already finalized");
    }

    // Update donation to finalized using Drizzle
    try {
      await donationsRepo.update(id, {
        finalized: true,
        iban: decoded.customer_iban || "",
        paymentMethod: decoded.payment_method_name || "",
      });
    } catch (error) {
      console.error(error);
      return ctx.badRequest("Failed to update donation");
    }

    if (donation.externalDonation) {
      await strapi
        .plugin("donations").service("donation")
        .sendExternalConfirmationEmail(id);
    } else {
      await strapi
        .plugin("donations").service("donation")
        .sendConfirmationEmail(id);
    }

    if (donation.dedicationEmail) {
      await strapi.plugin("donations").service("donation").sendDedicationEmail(id);
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

    // Fetch donation with details using Drizzle + Strapi cross-system query
    const donation = await strapi
      .plugin("donations").service("donation")
      .getDonationWithDetails(id);

    if (!donation) {
      return ctx.badRequest("Donation not found");
    }

    return ctx.send({ donation });
  },

  async import(ctx) {
    const fullData = ctx.request.body;

    await strapi.plugin("donations").service("donation").import(fullData);

    return ctx.send();
  },

  async export(ctx) {
    const fullData = await strapi.plugin("donations").service("donation").export();

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

    await strapi.plugin("donations").service("donation").deleteAll();

    return ctx.send();
  },

  async stats(ctx) {
    // let donorCount;
    // try {
    //   donorCount = await strapi
    //     .plugin("donations").service("donor")
    //     .donorsWithFinalizedDonationCount();
    // } catch (error) {
    //   console.error(error);
    //   return ctx.badRequest("Failed to get donor count");
    // }

    let donationSum;
    try {
      donationSum = await strapi
        .plugin("donations").service("donation")
        .sumOfFinalizedDonations();
    } catch (error) {
      console.error(error);
      return ctx.badRequest("Failed to get donation count");
    }

    let campaignSum;
    try {
      campaignSum = await strapi
        .plugin("donations").service("donation")
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
        .plugin("donations").service("donation")
        .findTransactionDonation({ idCode, amount, date });
    } catch (error) {
      console.error(error);
      return ctx.badRequest(error.message);
    }

    return ctx.send({ donation });
  },

  async insertTransaction(ctx) {
    const { idCode, amount, date, iban } = ctx.request.body;

    await strapi.plugin("donations").service("donation").insertFromTransaction({
      idCode,
      amount,
      date,
      iban,
    });

    return ctx.send();
  },

  async insertDonation(ctx) {
    const donation = { ...ctx.request.body };
    await strapi.plugin("donations").service("donation").insertDonation(donation);

    return ctx.send();
  },

  async migrateTips(ctx) {
    const migratedCount = await strapi
      .plugin("donations").service("donation")
      .migrateTips();

    const migratedRecurringCount = await strapi
      .plugin("donations").service("donation")
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
      .plugin("donations").service("donation")
      .getDonationsInDateRange(startDate, endDate);

    const donationIds = donations.map((donation) => donation.id);

    await strapi
      .plugin("donations").service("donation")
      .addDonationsToTransfer(donationIds, transferId);

    return ctx.send({
      message: `Added ${donationIds.length} donations to transfer ${transferId}`,
    });
  },
});
