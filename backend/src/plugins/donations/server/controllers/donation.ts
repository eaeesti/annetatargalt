import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import montonio, { type MontonioDecodedToken } from "../../../../utils/montonio";
import { DonationsRepository } from "../../../../db/repositories/donations.repository";

const donationsRepo = new DonationsRepository();

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async donate(ctx: Context) {
    const donation = ctx.request.body;

    try {
      const { redirectURL } = await strapi
        .plugin("donations")
        .service("donation")
        .createDonation(donation);
      return ctx.send({ redirectURL });
    } catch (error: unknown) {
      return ctx.badRequest(error instanceof Error ? error.message : String(error));
    }
  },

  async donateExternal(ctx: Context) {
    const returnUrl = ctx.request.body.returnUrl;
    if (!returnUrl) {
      return ctx.badRequest("No return URL provided");
    }

    const globalConfig = await strapi.documents("api::global.global").findFirst();
    if (!globalConfig) {
      return ctx.badRequest("Global config not found");
    }

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
    } catch (error: unknown) {
      return ctx.badRequest(error instanceof Error ? error.message : String(error));
    }
  },

  async donateForeign(ctx: Context) {
    const donation = ctx.request.body;

    try {
      const { redirectURL } = await strapi
        .plugin("donations")
        .service("donation")
        .createForeignDonation(donation);
      return ctx.send({ redirectURL });
    } catch (error: unknown) {
      return ctx.badRequest(error instanceof Error ? error.message : String(error));
    }
  },

  async confirm(ctx: Context) {
    const rawToken = ctx.request.query["order-token"];
    const orderToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!orderToken) {
      return ctx.badRequest("No order token provided");
    }

    let decoded: MontonioDecodedToken;
    try {
      decoded = montonio.decodeOrderToken(orderToken);
    } catch (error) {
      console.error(error);
      return ctx.badRequest("Invalid payment token");
    }

    if (decoded.paymentStatus !== "PAID") {
      return ctx.badRequest("Payment not paid");
    }

    if (!decoded.merchant_reference) {
      return ctx.badRequest("Invalid payment token: missing merchant reference");
    }
    const id = Number(decoded.merchant_reference.split(" ").pop());

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

  async decode(ctx: Context) {
    const rawToken = ctx.request.query["order-token"];
    const orderToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!orderToken) {
      return ctx.badRequest("No payment token provided");
    }

    let decoded: MontonioDecodedToken;
    try {
      decoded = montonio.decodeOrderToken(orderToken);
    } catch (error) {
      console.error(error);
      return ctx.badRequest("Invalid payment token");
    }

    if (decoded.paymentStatus !== "PAID") {
      return ctx.badRequest("Payment not paid");
    }

    if (!decoded.merchant_reference) {
      return ctx.badRequest("Invalid payment token: missing merchant reference");
    }
    const id = Number(decoded.merchant_reference.split(" ").pop());

    const donation = await strapi
      .plugin("donations")
      .service("donation")
      .getDonationWithDetails(id);

    if (!donation) {
      return ctx.badRequest("Donation not found");
    }

    return ctx.send({ donation });
  },

  async import(ctx: Context) {
    const fullData = ctx.request.body;

    await strapi.plugin("donations").service("donation").import(fullData);

    return ctx.send();
  },

  async export(ctx: Context) {
    const fullData = await strapi
      .plugin("donations")
      .service("donation")
      .export();

    return ctx.send(fullData);
  },

  async deleteAll(ctx: Context) {
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

  async stats(ctx: Context) {
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

  async findTransaction(ctx: Context) {
    const { idCode, amount, date } = ctx.request.query;

    let donation;
    try {
      donation = await strapi
        .plugin("donations")
        .service("donation")
        .findTransactionDonation({ idCode, amount, date });
    } catch (error: unknown) {
      console.error(error);
      return ctx.badRequest(error instanceof Error ? error.message : String(error));
    }

    return ctx.send({ donation });
  },

  async insertTransaction(ctx: Context) {
    const { idCode, amount, date, iban } = ctx.request.body;

    await strapi.plugin("donations").service("donation").insertFromTransaction({
      idCode,
      amount,
      date,
      iban,
    });

    return ctx.send();
  },

  async insertDonation(ctx: Context) {
    const donation = { ...ctx.request.body };
    await strapi
      .plugin("donations")
      .service("donation")
      .insertDonation(donation);

    return ctx.send();
  },

  async migrateTips(ctx: Context) {
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

  async addDonationsToTransferByDate(ctx: Context) {
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

    const donationIds = donations.map((donation: { id: number }) => donation.id);

    await strapi
      .plugin("donations")
      .service("donation")
      .addDonationsToTransfer(donationIds, transferId);

    return ctx.send({
      message: `Added ${donationIds.length} donations to transfer ${transferId}`,
    });
  },
});
