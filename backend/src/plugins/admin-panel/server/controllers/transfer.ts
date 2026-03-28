import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { donationTransfersRepository } from "../../../../db/repositories/donation-transfers.repository";
import { auditLog } from "../utils/audit-log";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "id",
  "datetime",
  "donationCount",
  "totalAmount",
]);

export default ({ strapi: _strapi }: { strapi: Core.Strapi }) => ({
  async list(ctx: Context) {
    const q = ctx.request.query;

    const page = Math.max(1, Number(q.page ?? 1));
    const pageSizeRaw = Number(q.pageSize ?? 50);
    const pageSize = VALID_PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : 50;
    const sortByRaw = String(q.sortBy ?? "datetime");
    const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "datetime";
    const sortDir = q.sortDir === "asc" ? ("asc" as const) : ("desc" as const);
    const dateFromRaw = q.dateFrom ? String(q.dateFrom) : undefined;
    const dateToRaw = q.dateTo ? String(q.dateTo) : undefined;
    const dateFrom =
      dateFromRaw && !isNaN(new Date(dateFromRaw).getTime())
        ? dateFromRaw
        : undefined;
    const dateTo =
      dateToRaw && !isNaN(new Date(dateToRaw).getTime())
        ? dateToRaw
        : undefined;

    const { data, total } = await donationTransfersRepository.findPaginated({
      page,
      pageSize,
      sortBy,
      sortDir,
      dateFrom,
      dateTo,
    });

    await auditLog(ctx, "transfers.list");

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
    if (!id || isNaN(id)) return ctx.badRequest("Invalid transfer ID");

    const transfer =
      await donationTransfersRepository.findByIdWithPerOrgTotals(id);
    if (!transfer) return ctx.notFound("Transfer not found");

    await auditLog(ctx, "transfers.findOne", String(id));

    return ctx.send({ data: transfer });
  },
});
