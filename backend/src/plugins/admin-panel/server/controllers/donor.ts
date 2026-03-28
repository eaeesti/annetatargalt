import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { donorsRepository } from "../../../../db/repositories/donors.repository";
import { auditLog } from "../utils/audit-log";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "id",
  "lastName",
  "email",
  "recurringDonor",
  "totalDonated",
  "donationCount",
  "lastDonationDate",
]);

export default ({ strapi: _strapi }: { strapi: Core.Strapi }) => ({
  async list(ctx: Context) {
    const q = ctx.request.query;

    const page = Math.max(1, Number(q.page ?? 1));
    const pageSizeRaw = Number(q.pageSize ?? 50);
    const pageSize = VALID_PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : 50;
    const sortByRaw = String(q.sortBy ?? "id");
    const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "id";
    const sortDir = q.sortDir === "desc" ? ("desc" as const) : ("asc" as const);
    const recurringDonor =
      q.recurringDonor !== undefined
        ? String(q.recurringDonor) === "true"
        : undefined;
    const searchRaw = q.search ? String(q.search).trim() : undefined;
    const search = searchRaw ? searchRaw.slice(0, 100) : undefined;

    const { data, total } = await donorsRepository.findPaginated({
      page,
      pageSize,
      sortBy,
      sortDir,
      search,
      recurringDonor,
    });

    await auditLog(ctx, "donors.list");

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
    if (!id || isNaN(id)) return ctx.badRequest("Invalid donor ID");

    const donor = await donorsRepository.findByIdWithDonations(id);
    if (!donor) return ctx.notFound("Donor not found");

    // Compute stats from finalized donations
    const finalized = donor.donations.filter((d) => d.finalized);
    const totalDonated = finalized.reduce((sum, d) => sum + d.amount, 0);
    const donationCount = finalized.length;
    const timestamps = finalized.map((d) => new Date(d.datetime).getTime());
    const firstDonationDate =
      timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
    const lastDonationDate =
      timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;

    await auditLog(ctx, "donors.findOne", String(id));

    return ctx.send({
      data: {
        ...donor,
        stats: {
          totalDonated,
          donationCount,
          firstDonationDate,
          lastDonationDate,
        },
      },
    });
  },
});
