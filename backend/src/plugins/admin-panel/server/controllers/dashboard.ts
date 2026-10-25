import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { dashboardRepository } from "../../../../db/repositories/dashboard.repository";
import { auditLog } from "../utils/audit-log";

export default ({ strapi }: { strapi: Core.Strapi }) => {
  /**
   * What the dashboard doesn't count as donations: what's given to the
   * external organization, which is only passed on to it (it stays in the
   * transactions and transfers, which do the passing on), and to Anneta
   * Targalt's own support organization, whose total is shown apart. The
   * homepage's total leaves out the same two.
   */
  async function organizations() {
    const global = await strapi.documents("api::global.global").findFirst();
    const external = global?.externalOrganizationInternalId || undefined;
    const support = global?.tipOrganizationInternalId || undefined;
    return {
      excluded: [external, support].filter((id) => typeof id === "string"),
      support,
    };
  }

  return {
    async stats(ctx: Context) {
      const { excluded, support } = await organizations();
      const data = await dashboardRepository.getStats(excluded, support);
      await auditLog(ctx, "dashboard.stats");
      return ctx.send({ data });
    },

    async charts(ctx: Context) {
      const { excluded } = await organizations();
      const data = await dashboardRepository.getCharts(excluded);
      await auditLog(ctx, "dashboard.charts");
      return ctx.send({ data });
    },
  };
};
