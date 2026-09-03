import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { createBankTransactionService } from "../services/bank-transaction";
import { auditLog } from "../utils/audit-log";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
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

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const service = createBankTransactionService(strapi);

  return {
    async list(ctx: Context) {
      const q = ctx.request.query;

      const pageRaw = Number(q.page ?? 1);
      const page = Number.isFinite(pageRaw)
        ? Math.max(1, Math.floor(pageRaw))
        : 1;
      // pageSize=all → 0 (repo returns every row)
      const pageSizeNum = Number(q.pageSize ?? 50);
      const pageSize =
        String(q.pageSize) === "all"
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
      });

      await auditLog(ctx, "bankTransactions.list");

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

      const body = (ctx.request.body ?? {}) as {
        category?: unknown;
        note?: unknown;
      };
      const category = String(body.category ?? "");
      const note =
        body.note == null ? null : String(body.note).slice(0, 512) || null;

      const user = ctx.state.user as { email?: string } | undefined;
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
