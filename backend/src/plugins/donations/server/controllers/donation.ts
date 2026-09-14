import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import montonio, {
  type MontonioDecodedToken,
} from "../../../../utils/montonio";
import { DonationsRepository } from "../../../../db/repositories/donations.repository";
import {
  FixedWindowLimiter,
  isProxyAddress,
} from "../../../../utils/rate-limiter";
import { isAllowedReturnUrl } from "../../../../utils/return-url";

const donationsRepo = new DonationsRepository();

const RECURRING_WINDOW_MS = 60 * 60 * 1000;

// Setting up a recurring donation mails standing-order instructions to
// whatever address the request names, with no payment, no account and no
// challenge in front of it — so an unauthenticated caller can use this to make
// the org's mail account send to anybody, as often as it likes. That burns
// sender reputation and can get the mail account suspended, which would take
// every donation receipt down with it.
//
// Setting one up is a rare, deliberate act: a donor does it once. Five an hour
// from one address is far more than a real person needs and far less than a
// script wants. Keyed per address and, separately, per recipient, because the
// second is what stops one victim being mail-bombed from many addresses.
const recurringSetupsPerIp = new FixedWindowLimiter(5, RECURRING_WINDOW_MS);
const recurringSetupsPerRecipient = new FixedWindowLimiter(
  3,
  RECURRING_WINDOW_MS,
);

/**
 * Consume recurring-setup allowance for this request, or report that the
 * caller is over it. Both limiters are checked before either is charged, so a
 * request turned away by one doesn't quietly eat the other's budget.
 */
function allowRecurringSetup(ctx: Context, email: unknown): boolean {
  const ip = ctx.request.ip;
  // While SERVER_PROXY is off every donor shares the proxy's address, so a
  // per-IP bucket would throttle all of them together rather than any one of
  // them — the sixth genuine donor of the hour would be turned away. The
  // per-recipient bucket doesn't depend on the address, so it keeps working
  // either way and still covers the mail-bombing case.
  const useIp = !isProxyAddress(ip);
  const recipient = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (useIp && recurringSetupsPerIp.isLimited(ip)) return false;
  if (recipient && recurringSetupsPerRecipient.isLimited(recipient)) {
    return false;
  }

  if (useIp) recurringSetupsPerIp.record(ip);
  if (recipient) recurringSetupsPerRecipient.record(recipient);
  return true;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async donate(ctx: Context) {
    const donation = ctx.request.body;

    if (
      donation?.type === "recurring" &&
      !allowRecurringSetup(ctx, donation?.email)
    ) {
      // Status must be passed to send() — Strapi's send(data, status = 200)
      // overwrites any ctx.status set beforehand.
      return ctx.send(
        { error: "Too many recurring donation setups. Try again later." },
        429,
      );
    }

    try {
      const { redirectURL } = await strapi
        .plugin("donations")
        .service("donation")
        .createDonation(donation);
      return ctx.send({ redirectURL });
    } catch (error: unknown) {
      return ctx.badRequest(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  async donateExternal(ctx: Context) {
    const returnUrl = ctx.request.body.returnUrl;
    if (!returnUrl) {
      return ctx.badRequest("No return URL provided");
    }
    if (!isAllowedReturnUrl(returnUrl)) {
      return ctx.badRequest("Return URL is not an allowed destination");
    }

    if (
      ctx.request.body?.type === "recurring" &&
      !allowRecurringSetup(ctx, ctx.request.body?.email)
    ) {
      // Status must be passed to send() — Strapi's send(data, status = 200)
      // overwrites any ctx.status set beforehand.
      return ctx.send(
        { error: "Too many recurring donation setups. Try again later." },
        429,
      );
    }

    const globalConfig = await strapi
      .documents("api::global.global")
      .findFirst();
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
      return ctx.badRequest(
        error instanceof Error ? error.message : String(error),
      );
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
      return ctx.badRequest(
        error instanceof Error ? error.message : String(error),
      );
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
      return ctx.badRequest(
        "Invalid payment token: missing merchant reference",
      );
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
      return ctx.badRequest(
        "Invalid payment token: missing merchant reference",
      );
    }
    const id = Number(decoded.merchant_reference.split(" ").pop());

    const donation = await strapi
      .plugin("donations")
      .service("donation")
      .getDonationWithDetails(id);

    if (!donation) {
      return ctx.badRequest("Donation not found");
    }

    // getDonationWithDetails also backs the confirmation/dedication emails,
    // which need the donor's full row (email as the send-to address, etc.) —
    // but this is a public, auth:false endpoint, and the thank-you page's
    // CMS templates only ever use the donor's first name. The order-token
    // that gates this isn't forgeable, but it can still leak via browser
    // history, referrers, or a shared link, so don't hand back more of the
    // donor's data than the page renders.
    return ctx.send({
      donation: {
        ...donation,
        donor: donation.donor
          ? { firstName: donation.donor.firstName }
          : undefined,
      },
    });
  },

  async export(ctx: Context) {
    const fullData = await strapi
      .plugin("donations")
      .service("donation")
      .export();

    return ctx.send(fullData);
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
      return ctx.badRequest(
        error instanceof Error ? error.message : String(error),
      );
    }

    return ctx.send({ donation });
  },
});
