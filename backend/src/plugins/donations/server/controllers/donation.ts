import { decodeOrderToken } from "../../../../utils/montonio";
import { DonationsRepository } from "../../../../db/repositories/donations.repository";

const donationsRepo = new DonationsRepository();

export default ({ strapi }: any) => ({
  async donate(ctx: any) {
    const donation = ctx.request.body;

    try {
      const { redirectURL } = await strapi
        .plugin("donations")
        .service("donation")
        .createDonation(donation);
      return ctx.send({ redirectURL });
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
  },

  async donateExternal(ctx: any) {
    const returnUrl = ctx.request.body.returnUrl;
    if (!returnUrl) {
      return ctx.badRequest("No return URL provided");
    }

    const globalConfig = await strapi.db.query("api::global.global").findOne();

    const donation = {
      ...ctx.request.body,
      comment: `Return URL: ${returnUrl}`,
      amounts: [
        {
          amount: ctx.request.body.amount,
          organizationInternalId: globalConfig.externalOrganizationInternalId,
        },
      ],
    };

    try {
      const { redirectURL } = await strapi
        .plugin("donations")
        .service("donation")
        .createDonation(donation, returnUrl, true);
      return ctx.send({ redirectURL });
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
  },

  async donateForeign(ctx: any) {
    const donation = ctx.request.body;

    try {
      const { redirectURL } = await strapi
        .plugin("donations")
        .service("donation")
        .createForeignDonation(donation);
      return ctx.send({ redirectURL });
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
  },

  async confirm(ctx: any) {
    const orderToken = ctx.request.query["order-token"];

    if (!orderToken) {
      return ctx.badRequest("No order token provided");
    }

    let decoded: any;
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

    const donation = await donationsRepo.findById(id);

    if (!donation) {
      return ctx.badRequest("Donation not found");
    }

    if (donation.finalized) {
      return ctx.badRequest("Donation already finalized");
    }

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
        .plugin("donations")
        .service("donation")
        .sendExternalConfirmationEmail(id);
    } else {
      await strapi
        .plugin("donations")
        .service("donation")
        .sendConfirmationEmail(id);
    }

    if (donation.dedicationEmail) {
      await strapi
        .plugin("donations")
        .service("donation")
        .sendDedicationEmail(id);
    }

    return ctx.send();
  },

  async decode(ctx: any) {
    const orderToken = ctx.request.query["order-token"];

    if (!orderToken) {
      return ctx.badRequest("No payment token provided");
    }

    let decoded: any;
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

    const donation = await strapi
      .plugin("donations")
      .service("donation")
      .getDonationWithDetails(id);

    if (!donation) {
      return ctx.badRequest("Donation not found");
    }

    return ctx.send({ donation });
  },

  async import(ctx: any) {
    const fullData = ctx.request.body;

    await strapi.plugin("donations").service("donation").import(fullData);

    return ctx.send();
  },

  async export(ctx: any) {
    const fullData = await strapi
      .plugin("donations")
      .service("donation")
      .export();

    return ctx.send(fullData);
  },

  async deleteAll(ctx: any) {
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

  async stats(ctx: any) {
    let donationSum;
    try {
      donationSum = await strapi
        .plugin("donations")
        .service("donation")
        .sumOfFinalizedDonations();
    } catch (error) {
      console.error(error);
      return ctx.badRequest("Failed to get donation count");
    }

    return ctx.send({
      donationSum,
    });
  },

  async findTransaction(ctx: any) {
    const { idCode, amount, date } = ctx.request.query;

    let donation;
    try {
      donation = await strapi
        .plugin("donations")
        .service("donation")
        .findTransactionDonation({ idCode, amount, date });
    } catch (error: any) {
      console.error(error);
      return ctx.badRequest(error.message);
    }

    return ctx.send({ donation });
  },

  async insertTransaction(ctx: any) {
    const { idCode, amount, date, iban } = ctx.request.body;

    await strapi.plugin("donations").service("donation").insertFromTransaction({
      idCode,
      amount,
      date,
      iban,
    });

    return ctx.send();
  },

  async insertDonation(ctx: any) {
    const donation = { ...ctx.request.body };
    await strapi
      .plugin("donations")
      .service("donation")
      .insertDonation(donation);

    return ctx.send();
  },

  async migrateTips(ctx: any) {
    const migratedCount = await strapi
      .plugin("donations")
      .service("donation")
      .migrateTips();

    const migratedRecurringCount = await strapi
      .plugin("donations")
      .service("donation")
      .migrateRecurringTips();

    return ctx.send({ migratedCount, migratedRecurringCount });
  },

  async addDonationsToTransferByDate(ctx: any) {
    const { startDate, endDate, transferId } = ctx.request.body;

    if (!startDate || !endDate || !transferId) {
      return ctx.badRequest(
        "Missing required fields (startDate, endDate, transferId)"
      );
    }

    const donations = await strapi
      .plugin("donations")
      .service("donation")
      .getDonationsInDateRange(startDate, endDate);

    const donationIds = donations.map((donation: any) => donation.id);

    await strapi
      .plugin("donations")
      .service("donation")
      .addDonationsToTransfer(donationIds, transferId);

    return ctx.send({
      message: `Added ${donationIds.length} donations to transfer ${transferId}`,
    });
  },
});
