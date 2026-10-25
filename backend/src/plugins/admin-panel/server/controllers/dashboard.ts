import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { dashboardRepository } from "../../../../db/repositories/dashboard.repository";
import { auditLog } from "../utils/audit-log";

export default ({ strapi }: { strapi: Core.Strapi }) => {
  /**
   * What's given to the external organization is only passed on to it, so
   * it isn't Anneta Targalt's to count. It stays in the transactions and
   * transfers, which do the passing on.
   */
  async function excludedOrganizations(): Promise<string[]> {
    const global = await strapi.documents("api::global.global").findFirst();
    const external = global?.externalOrganizationInternalId;
    return external ? [external] : [];
  }

  return {
    async stats(ctx: Context) {
      const data = await dashboardRepository.getStats(
        await excludedOrganizations(),
      );
      await auditLog(ctx, "dashboard.stats");
      return ctx.send({ data });
    },

    async charts(ctx: Context) {
      const data = await dashboardRepository.getCharts(
        await excludedOrganizations(),
      );
      await auditLog(ctx, "dashboard.charts");
      return ctx.send({ data });
    },
  };
};
