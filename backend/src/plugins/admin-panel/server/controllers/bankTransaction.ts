import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { createBankTransactionService } from "../services/bank-transaction";
import { auditLog } from "../utils/audit-log";
import { currentUser } from "../utils/current-user";
import { isRecord, oneOf } from "../../../../utils/narrow";
import type { BalancedFilter } from "../../../../db/repositories/bank-transactions.repository";
import { EXPORT_ROW_LIMIT, isExport } from "../utils/export";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const BALANCED_STATES: readonly BalancedFilter[] = ["ok", "not-ok", "unknown"];
const VALID_SORT_COLS = new Set([
  "date",
  "amount",
  "category",
  "counterpartyName",
  "importedAt",
]);

/** Strict `YYYY-MM-DD` — anything else is dropped (never forwarded to Postgres). */
const isoDate = (v: unknown): string | undefined => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s
    ? undefined
    : s;
};

/** A euro amount from the query string, in cents; anything else is ignored. */
function eurosToCents(value: unknown): number | undefined {
  if (value === undefined || value === "") return undefined;
  const euros = Number(value);
  return Number.isFinite(euros) && euros >= 0
    ? Math.round(euros * 100)
    : undefined;
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const service = createBankTransactionService(strapi);

  return {
    async list(ctx: Context) {
      const q = ctx.request.query;
      const exporting = isExport(q);

      const pageRaw = Number(q.page ?? 1);
      const page =
        !exporting && Number.isFinite(pageRaw)
          ? Math.max(1, Math.floor(pageRaw))
          : 1;
      // pageSize=all → 0 (repo returns every row)
      const pageSizeNum = Number(q.pageSize ?? 50);
      const pageSize = exporting
        ? EXPORT_ROW_LIMIT
        : String(q.pageSize) === "all"
          ? 0
          : VALID_PAGE_SIZES.includes(pageSizeNum)
            ? pageSizeNum
            : 50;
      const sortByRaw = String(q.sortBy ?? "date");
      const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "date";
      const sortDir =
        q.sortDir === "asc" ? ("asc" as const) : ("desc" as const);

      const { data, total } = await service.list({
        page,
        pageSize,
        sortBy,
        sortDir,
        category: q.category ? String(q.category) : undefined,
        dateFrom: isoDate(q.dateFrom),
        dateTo: isoDate(q.dateTo),
        search: q.search ? String(q.search).slice(0, 128) : undefined,
        amountMin: eurosToCents(q.amountMin),
        amountMax: eurosToCents(q.amountMax),
        balanced: oneOf(q.balanced, BALANCED_STATES),
      });

      await auditLog(
        ctx,
        exporting ? "bankTransactions.export" : "bankTransactions.list",
        exporting ? `${data.length} rows` : undefined,
      );

      return ctx.send({
        data,
        pagination: {
          page: pageSize > 0 ? page : 1,
          pageSize,
          total,
          pageCount: pageSize > 0 ? Math.ceil(total / pageSize) : 1,
        },
      });
    },

    async summary(ctx: Context) {
      const q = ctx.request.query;
      const result = await service.summary({
        dateFrom: isoDate(q.dateFrom) ?? null,
        dateTo: isoDate(q.dateTo) ?? null,
      });
      await auditLog(ctx, "bankTransactions.summary");
      return ctx.send(result);
    },

    async findOne(ctx: Context) {
      const code = String(ctx.params.code ?? "").trim();
      if (!code) return ctx.badRequest("Missing archiving code");

      const row = await service.findOne(code);
      if (!row) return ctx.notFound("Bank transaction not found");

      await auditLog(ctx, "bankTransactions.findOne", code);
      return ctx.send({ data: row });
    },

    async update(ctx: Context) {
      const code = String(ctx.params.code ?? "").trim();
      if (!code) return ctx.badRequest("Missing archiving code");

      const body = isRecord(ctx.request.body) ? ctx.request.body : {};
      const category = String(body.category ?? "");
      const note =
        body.note === null || body.note === undefined
          ? null
          : String(body.note).slice(0, 512) || null;

      const user = currentUser(ctx);

      // note-only edit (no category in the body) — e.g. documenting a payout
      // from the transfer view. Skips the reclassify / donation-link checks.
      if (category === "") {
        if (body.note === undefined) {
          return ctx.badRequest("Nothing to update");
        }
        const noteResult = await service.setNote(code, note);
        if (!noteResult.ok) {
          return ctx.notFound("Bank transaction not found");
        }
        await auditLog(ctx, "bankTransactions.note", code);
        return ctx.send({ ok: true });
      }

      const result = await service.reclassify(
        code,
        category,
        note,
        user?.email ?? "unknown",
      );

      if (!result.ok) {
        if (result.reason === "has-donations") {
          ctx.status = 409;
          return ctx.send({
            error: {
              status: 409,
              name: "ConflictError",
              message:
                "This code has donations linked to it — reassign or delete them first",
            },
          });
        }
        if (result.reason === "not-found") {
          return ctx.notFound("Bank transaction not found");
        }
        return ctx.badRequest("Invalid category");
      }

      await auditLog(ctx, "bankTransactions.update", `${code} → ${category}`);
      return ctx.send({ ok: true });
    },
  };
};
