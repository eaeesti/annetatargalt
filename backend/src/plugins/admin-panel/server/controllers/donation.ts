import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { donationsRepository } from "../../../../db/repositories/donations.repository";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set(["id", "datetime", "amount", "finalized", "paymentMethod", "companyName"]);

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
      q.hasTransfer !== undefined ? String(q.hasTransfer) === "true" : undefined;
    const hasCompany =
      q.hasCompany !== undefined ? String(q.hasCompany) === "true" : undefined;
    const orgId = q.orgId ? String(q.orgId) : undefined;

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
    });

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
});
