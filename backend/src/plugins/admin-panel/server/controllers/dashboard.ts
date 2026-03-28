import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { dashboardRepository } from "../../../../db/repositories/dashboard.repository";
import { auditLog } from "../utils/audit-log";

export default ({ strapi: _strapi }: { strapi: Core.Strapi }) => ({
  async stats(ctx: Context) {
    const data = await dashboardRepository.getStats();
    await auditLog(ctx, "dashboard.stats");
    return ctx.send({ data });
  },

  async charts(ctx: Context) {
    const data = await dashboardRepository.getCharts();
    await auditLog(ctx, "dashboard.charts");
    return ctx.send({ data });
  },
});
