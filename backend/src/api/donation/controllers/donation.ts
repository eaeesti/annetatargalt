/**
 * Donation controller proxy
 *
 * This is a thin wrapper that delegates all calls to the donations plugin.
 * Routes are defined here for backward compatibility (/api/* URLs),
 * but the actual logic lives in src/plugins/donations/
 */
import type { Context } from "koa";

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

  async import(ctx: Context) {
    return ctrl().import(ctx);
  },

  async export(ctx: Context) {
    return ctrl().export(ctx);
  },

  async deleteAll(ctx: Context) {
    return ctrl().deleteAll(ctx);
  },

  async findTransaction(ctx: Context) {
    return ctrl().findTransaction(ctx);
  },

  async insertTransaction(ctx: Context) {
    return ctrl().insertTransaction(ctx);
  },

  async insertDonation(ctx: Context) {
    return ctrl().insertDonation(ctx);
  },

  async stats(ctx: Context) {
    return ctrl().stats(ctx);
  },

  async migrateTips(ctx: Context) {
    return ctrl().migrateTips(ctx);
  },

  async addDonationsToTransferByDate(ctx: Context) {
    return ctrl().addDonationsToTransferByDate(ctx);
  },
};
