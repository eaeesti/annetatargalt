import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { donationsRepository } from "../../../../db/repositories/donations.repository";
import { adminAuditLogRepository } from "../../../../db/repositories/adminAuditLog.repository";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "id",
  "datetime",
  "amount",
  "finalized",
  "paymentMethod",
  "companyName",
]);

async function auditLog(ctx: Context, action: string, recordId?: string) {
  try {
    const user = ctx.state.user as { id: number; email: string } | undefined;
    if (!user) return;
    const ip = ctx.ip || null;
    await adminAuditLogRepository.log({
      userId: String(user.id),
      userEmail: user.email,
      action,
      recordId: recordId ?? null,
      ip,
    });
  } catch {
    // Never fail the request due to audit logging errors
  }
}

export default ({ strapi: _strapi }: { strapi: Core.Strapi }) => ({
  async list(ctx: Context) {
    const q = ctx.request.query;

    const page = Math.max(1, Number(q.page ?? 1));
    const pageSizeRaw = Number(q.pageSize ?? 50);
    const pageSize = VALID_PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : 50;

    const sortByRaw = String(q.sortBy ?? "datetime");
    const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "datetime";
    const sortDir = q.sortDir === "asc" ? ("asc" as const) : ("desc" as const);

    const finalized =
      q.finalized !== undefined ? String(q.finalized) === "true" : undefined;
    const dateFrom = q.dateFrom ? new Date(String(q.dateFrom)) : undefined;
    const dateTo = q.dateTo ? new Date(String(q.dateTo)) : undefined;
    const donorId = q.donorId ? Number(q.donorId) : undefined;
    const transferId = q.transferId ? Number(q.transferId) : undefined;
    const hasTransfer =
      q.hasTransfer !== undefined
        ? String(q.hasTransfer) === "true"
        : undefined;
    const hasCompany =
      q.hasCompany !== undefined ? String(q.hasCompany) === "true" : undefined;
    const orgId = q.orgId ? String(q.orgId) : undefined;
    // UI sends euros; DB stores cents
    const amountMin = q.amountMin
      ? Math.round(Number(q.amountMin) * 100)
      : undefined;
    const amountMax = q.amountMax
      ? Math.round(Number(q.amountMax) * 100)
      : undefined;

    const { data, total } = await donationsRepository.findWithFilters({
      page,
      pageSize,
      sortBy,
      sortDir,
      finalized,
      dateFrom,
      dateTo,
      donorId,
      transferId,
      hasTransfer,
      hasCompany,
      orgId,
      amountMin,
      amountMax,
    });

    await auditLog(ctx, "donations.list");

    return ctx.send({
      data,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    });
  },

  async findOne(ctx: Context) {
    const id = Number(ctx.params.id);
    if (!id || isNaN(id)) {
      return ctx.badRequest("Invalid donation ID");
    }

    const donation = await donationsRepository.findByIdWithRelations(id);
    if (!donation) {
      return ctx.notFound("Donation not found");
    }

    await auditLog(ctx, "donations.findOne", String(id));

    return ctx.send({ data: donation });
  },
});
