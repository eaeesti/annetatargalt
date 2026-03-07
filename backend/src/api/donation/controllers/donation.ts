/**
 * Donation controller proxy
 *
 * This is a thin wrapper that delegates all calls to the donations plugin.
 * Routes are defined here for backward compatibility (/api/* URLs),
 * but the actual logic lives in src/plugins/donations/
 *
 * Note: Uses global.strapi for delegation only. All actual business logic
 * in the plugin uses proper dependency injection.
 */

export default {
  async donate(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .donate(ctx);
  },

  async donateExternal(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .donateExternal(ctx);
  },

  async donateForeign(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .donateForeign(ctx);
  },

  async confirm(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .confirm(ctx);
  },

  async decode(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .decode(ctx);
  },

  async import(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .import(ctx);
  },

  async export(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .export(ctx);
  },

  async deleteAll(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .deleteAll(ctx);
  },

  async findTransaction(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .findTransaction(ctx);
  },

  async insertTransaction(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .insertTransaction(ctx);
  },

  async insertDonation(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .insertDonation(ctx);
  },

  async stats(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .stats(ctx);
  },

  async migrateTips(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .migrateTips(ctx);
  },

  async addDonationsToTransferByDate(ctx: any) {
    return (global as any).strapi
      .plugin("donations")
      .controller("donation")
      .addDonationsToTransferByDate(ctx);
  },
};
