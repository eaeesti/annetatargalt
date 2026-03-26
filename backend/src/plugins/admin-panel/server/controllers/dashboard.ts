import type { Core } from "@strapi/strapi";
import { dashboardRepository } from "../../../../db/repositories/dashboard.repository";

export default ({ strapi: _strapi }: { strapi: Core.Strapi }) => ({
  async stats(ctx: { body: unknown }) {
    const data = await dashboardRepository.getStats();
    ctx.body = { data };
  },

  async charts(ctx: { body: unknown }) {
    const data = await dashboardRepository.getCharts();
    ctx.body = { data };
  },
});
