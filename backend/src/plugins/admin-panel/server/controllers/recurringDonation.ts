import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { recurringDonationsRepository } from "../../../../db/repositories/recurring-donations.repository";
import { adminAuditLogRepository } from "../../../../db/repositories/adminAuditLog.repository";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "id",
  "active",
  "amount",
  "datetime",
  "donorLastName",
  "donationCount",
  "lastDonationDate",
]);

async function auditLog(ctx: Context, action: string, recordId?: string) {
  try {
    const user = ctx.state.user as { id: number; email: string } | undefined;
    if (!user) return;
    const ip =
      ctx.get("X-Forwarded-For").split(",")[0]?.trim() || ctx.ip || null;
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
    const sortByRaw = String(q.sortBy ?? "id");
    const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "id";
    const sortDir = q.sortDir === "desc" ? ("desc" as const) : ("asc" as const);
    const active =
      q.active !== undefined ? String(q.active) === "true" : undefined;

    const { data, total } = await recurringDonationsRepository.findPaginated({
      page,
      pageSize,
      sortBy,
      sortDir,
      active,
    });

    await auditLog(ctx, "recurringDonations.list");

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
    if (!id || isNaN(id))
      return ctx.badRequest("Invalid recurring donation ID");

    const rd = await recurringDonationsRepository.findByIdWithFullDonations(id);
    if (!rd) return ctx.notFound("Recurring donation not found");

    // Gap detection: expected months from start date to today
    const startDate = new Date(rd.datetime);
    const now = new Date();
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth(); // 0-indexed
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();

    // Set of "YYYY-MM" strings for months that have a finalized linked donation
    const coveredMonths = new Set<string>();
    for (const d of rd.donations) {
      if (!d.finalized) continue;
      const dt = new Date(d.datetime);
      coveredMonths.add(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    // Build expected months list
    const gapMonths: string[] = [];
    let y = startYear;
    let m = startMonth; // 0-indexed
    while (y < nowYear || (y === nowYear && m <= nowMonth)) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      if (!coveredMonths.has(key)) {
        gapMonths.push(key);
      }
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }

    await auditLog(ctx, "recurringDonations.findOne", String(id));

    return ctx.send({
      data: {
        ...rd,
        gapMonths,
      },
    });
  },
});
