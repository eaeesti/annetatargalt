import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { organizationDonationsRepository } from "../../../../db/repositories/organization-donations.repository";
import { auditLog } from "../utils/audit-log";

export default ({ strapi: _strapi }: { strapi: Core.Strapi }) => ({
  async stats(ctx: Context) {
    const rows = await organizationDonationsRepository.getStats();
    await auditLog(ctx, "organizations.stats");
    return ctx.send({ data: rows });
  },
});
