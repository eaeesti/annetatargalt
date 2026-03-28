import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { dashboardRepository } from "../../../../db/repositories/dashboard.repository";
import { adminAuditLogRepository } from "../../../../db/repositories/adminAuditLog.repository";

async function auditLog(ctx: Context, action: string) {
  try {
    const user = ctx.state.user as { id: number; email: string } | undefined;
    if (!user) return;
    const ip = ctx.ip || null;
    await adminAuditLogRepository.log({
      userId: String(user.id),
      userEmail: user.email,
      action,
      recordId: null,
      ip,
    });
  } catch {
    // Never fail the request due to audit logging errors
  }
}

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
