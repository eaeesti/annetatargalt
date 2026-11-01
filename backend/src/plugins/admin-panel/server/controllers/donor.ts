import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import {
  donorsRepository,
  type RecurringStatus,
} from "../../../../db/repositories/donors.repository";
import { auditLog } from "../utils/audit-log";
import { idOf, isRecord, oneOf } from "../../../../utils/narrow";
import { toLocale } from "../../../../utils/locale";
import { emailPreferencesUrl } from "../../../../emails";
import { preferenceChanges } from "../../../../utils/email-preferences";
import { EXPORT_ROW_LIMIT, isExport } from "../utils/export";

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
const RECURRING_STATUSES: readonly RecurringStatus[] = [
  "new",
  "retained",
  "churned",
  "churnedAllTime",
];

/** One of "new"/"retained"/"churned"/"churnedAllTime", or undefined otherwise. */
function parseRecurringStatus(v: unknown): RecurringStatus | undefined {
  return oneOf(v, RECURRING_STATUSES);
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async list(ctx: Context) {
    const q = ctx.request.query;
    const exporting = isExport(q);

    const page = exporting ? 1 : Math.max(1, Number(q.page ?? 1));
    const pageSizeRaw = Number(q.pageSize ?? 50);
    const pageSize = exporting
      ? EXPORT_ROW_LIMIT
      : VALID_PAGE_SIZES.includes(pageSizeRaw)
        ? pageSizeRaw
        : 50;
    const sortByRaw = String(q.sortBy ?? "id");
    const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "id";
    const sortDir = q.sortDir === "desc" ? ("desc" as const) : ("asc" as const);
    const recurringDonor =
      q.recurringDonor !== undefined
        ? String(q.recurringDonor) === "true"
        : undefined;
    const recurringStatus = parseRecurringStatus(q.recurringStatus);
    const searchRaw = q.search ? String(q.search).trim() : undefined;
    const search = searchRaw ? searchRaw.slice(0, 100) : undefined;

    const { data, total } = await donorsRepository.findPaginated({
      page,
      pageSize,
      sortBy,
      sortDir,
      search,
      recurringDonor,
      recurringStatus,
    });

    await auditLog(
      ctx,
      exporting ? "donors.export" : "donors.list",
      exporting ? `${data.length} rows` : undefined,
    );

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
    const id = idOf(ctx.params.id);
    if (!id) return ctx.badRequest("Invalid donor ID");

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
        // Which emails the address gets, from all its donor rows, as sending
        // decides it, rather than this row's own settings.
        ...(await donorsRepository.findEmailPreferences(id)),
        // The page the links in the donor's emails lead to, in the language
        // they last gave in: a standing order's payment is in the order's.
        emailPreferencesUrl: emailPreferencesUrl(
          strapi,
          donor.id,
          toLocale(
            donor.recurringDonations.find(
              (order) => order.id === finalized[0]?.recurringDonationId,
            )?.locale ?? finalized[0]?.locale,
          ),
        ),
        stats: {
          totalDonated,
          donationCount,
          firstDonationDate,
          lastDonationDate,
        },
      },
    });
  },

  async updateEmailPreferences(ctx: Context) {
    const id = idOf(ctx.params.id);
    if (!id) return ctx.badRequest("Invalid donor ID");

    const parsed = preferenceChanges(
      isRecord(ctx.request.body) ? ctx.request.body : {},
    );
    if ("error" in parsed) return ctx.badRequest(parsed.error);

    await donorsRepository.updateEmailPreferences(id, parsed.changes);
    const preferences = await donorsRepository.findEmailPreferences(id);
    if (!preferences) return ctx.notFound("Donor not found");

    await auditLog(ctx, "donors.updateEmailPreferences", String(id));

    return ctx.send({ data: preferences });
  },
});
