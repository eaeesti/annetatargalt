/**
 * Donation controller proxy
 *
 * This is a thin wrapper that delegates all calls to the donations plugin.
 * Routes are defined here for backward compatibility (/api/* URLs),
 * but the actual logic lives in src/plugins/donations/
 */
import type { Context, Next } from "koa";
import { auditLog } from "../../../plugins/admin-panel/server/utils/audit-log";

function ctrl() {
  return strapi.plugin("donations").controller("donation");
}

export default {
  async donate(ctx: Context, next: Next) {
    return ctrl().donate(ctx, next);
  },

  async donateExternal(ctx: Context, next: Next) {
    return ctrl().donateExternal(ctx, next);
  },

  async donateForeign(ctx: Context, next: Next) {
    return ctrl().donateForeign(ctx, next);
  },

  async confirm(ctx: Context, next: Next) {
    return ctrl().confirm(ctx, next);
  },

  async decode(ctx: Context, next: Next) {
    return ctrl().decode(ctx, next);
  },

  // The two authenticated reads on this router, and the only admin-reachable
  // routes in the app that weren't recorded anywhere. Logged before
  // delegating, so an attempt is on the record even if the call then fails.
  async export(ctx: Context, next: Next) {
    // Returns every donor and every donation in one response — the largest
    // single disclosure any account can cause, and previously silent.
    await auditLog(ctx, "donations.export");
    return ctrl().export(ctx, next);
  },

  async findTransaction(ctx: Context, next: Next) {
    // Looks a donor up by personal code, so the code is what identifies the
    // record here. It is the same value already held on the donor row, and
    // without it the entry would not say who was looked up.
    const { idCode } = ctx.request.query;
    await auditLog(
      ctx,
      "donations.findTransaction",
      typeof idCode === "string" ? idCode : undefined,
    );
    return ctrl().findTransaction(ctx, next);
  },

  async stats(ctx: Context, next: Next) {
    return ctrl().stats(ctx, next);
  },
};
