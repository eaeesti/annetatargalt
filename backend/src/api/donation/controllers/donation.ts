/**
 * Donation controller proxy
 *
 * This is a thin wrapper that delegates all calls to the donations plugin.
 * Routes are defined here for backward compatibility (/api/* URLs),
 * but the actual logic lives in src/plugins/donations/
 */
import type { Context } from "koa";
import { auditLog } from "../../../plugins/admin-panel/server/utils/audit-log";

type DonationCtrl = Record<string, (ctx: Context) => Promise<void>>;
function ctrl(): DonationCtrl {
  return strapi.plugin("donations").controller("donation") as DonationCtrl;
}

export default {
  async donate(ctx: Context) {
    return ctrl().donate(ctx);
  },

  async donateExternal(ctx: Context) {
    return ctrl().donateExternal(ctx);
  },

  async donateForeign(ctx: Context) {
    return ctrl().donateForeign(ctx);
  },

  async confirm(ctx: Context) {
    return ctrl().confirm(ctx);
  },

  async decode(ctx: Context) {
    return ctrl().decode(ctx);
  },

  // The two authenticated reads on this router, and the only admin-reachable
  // routes in the app that weren't recorded anywhere. Logged before
  // delegating, so an attempt is on the record even if the call then fails.
  async export(ctx: Context) {
    // Returns every donor and every donation in one response — the largest
    // single disclosure any account can cause, and previously silent.
    await auditLog(ctx, "donations.export");
    return ctrl().export(ctx);
  },

  async findTransaction(ctx: Context) {
    // Looks a donor up by personal code, so the code is what identifies the
    // record here. It is the same value already held on the donor row, and
    // without it the entry would not say who was looked up.
    const { idCode } = ctx.request.query;
    await auditLog(
      ctx,
      "donations.findTransaction",
      typeof idCode === "string" ? idCode : undefined,
    );
    return ctrl().findTransaction(ctx);
  },

  async stats(ctx: Context) {
    return ctrl().stats(ctx);
  },
};
