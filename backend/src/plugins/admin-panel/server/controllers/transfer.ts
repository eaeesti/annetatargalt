import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { donationTransfersRepository } from "../../../../db/repositories/donation-transfers.repository";
import { createTransferService } from "../services/transfer";
import { auditLog } from "../utils/audit-log";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "id",
  "datetime",
  "donationCount",
  "totalAmount",
]);

/** Strict `YYYY-MM-DD` — anything else is dropped. */
const isoDate = (v: unknown): string | undefined => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s
    ? undefined
    : s;
};

const intArray = (v: unknown): number[] =>
  Array.isArray(v)
    ? [
        ...new Set(
          v
            .map((x) => Math.floor(Number(x)))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      ]
    : [];

const CODE_RE = /^[A-Za-z0-9_-]{1,20}$/;
const codeArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? [
        ...new Set(
          v.map((x) => String(x).trim()).filter((s) => CODE_RE.test(s)),
        ),
      ]
    : [];

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const service = createTransferService(strapi);

  return {
    async list(ctx: Context) {
      const q = ctx.request.query;

      const page = Math.max(1, Number(q.page ?? 1) || 1);
      const pageSizeRaw = Number(q.pageSize ?? 50);
      const pageSize = VALID_PAGE_SIZES.includes(pageSizeRaw)
        ? pageSizeRaw
        : 50;
      const sortByRaw = String(q.sortBy ?? "datetime");
      const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "datetime";
      const sortDir =
        q.sortDir === "asc" ? ("asc" as const) : ("desc" as const);

      const { data, total } = await donationTransfersRepository.findPaginated({
        page,
        pageSize,
        sortBy,
        sortDir,
        dateFrom: isoDate(q.dateFrom),
        dateTo: isoDate(q.dateTo),
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

      const transfer = await service.getOne(id);
      if (!transfer) return ctx.notFound("Transfer not found");

      await auditLog(ctx, "transfers.findOne", String(id));
      return ctx.send({ data: transfer });
    },

    async preview(ctx: Context) {
      const q = ctx.request.query;
      const dateFrom = isoDate(q.dateFrom);
      const dateTo = isoDate(q.dateTo);
      if (!dateFrom || !dateTo) {
        return ctx.badRequest("dateFrom and dateTo (YYYY-MM-DD) are required");
      }
      const donations = await service.preview(dateFrom, dateTo);
      await auditLog(ctx, "transfers.preview");
      return ctx.send({ data: donations });
    },

    async unlinkedOutgoing(ctx: Context) {
      const q = ctx.request.query;
      const rows = await service.unlinkedOutgoing({
        dateFrom: isoDate(q.dateFrom),
        dateTo: isoDate(q.dateTo),
        search: q.search ? String(q.search).slice(0, 128) : undefined,
      });
      return ctx.send({ data: rows });
    },

    async create(ctx: Context) {
      const body = (ctx.request.body ?? {}) as Record<string, unknown>;
      const datetime = isoDate(body.datetime);
      if (!datetime) return ctx.badRequest("datetime (YYYY-MM-DD) is required");
      const notes =
        body.notes == null ? null : String(body.notes).slice(0, 2000) || null;
      const donationIds = intArray(body.donationIds);

      const transfer = await service.create({ datetime, notes, donationIds });
      await auditLog(
        ctx,
        "transfers.create",
        `#${transfer.id} donations=${donationIds.length}`,
      );
      return ctx.send({ data: transfer });
    },

    async update(ctx: Context) {
      const id = Number(ctx.params.id);
      if (!id || isNaN(id)) return ctx.badRequest("Invalid transfer ID");

      const body = (ctx.request.body ?? {}) as Record<string, unknown>;

      // a datetime that's present but unparseable is an error, not a silent skip
      let datetime: string | undefined;
      if (body.datetime !== undefined) {
        datetime = isoDate(body.datetime);
        if (!datetime)
          return ctx.badRequest("Invalid date (expected YYYY-MM-DD)");
      }

      const input = {
        datetime,
        notes:
          body.notes === undefined
            ? undefined
            : body.notes == null
              ? null
              : String(body.notes).slice(0, 2000) || null,
        addDonationIds: intArray(body.addDonationIds),
        removeDonationIds: intArray(body.removeDonationIds),
        linkCodes: codeArray(body.linkCodes),
        unlinkCodes: codeArray(body.unlinkCodes),
      };

      let result;
      try {
        result = await service.update(id, input);
      } catch (err) {
        return ctx.badRequest(err instanceof Error ? err.message : String(err));
      }
      if (!result.ok) return ctx.notFound("Transfer not found");

      await auditLog(
        ctx,
        "transfers.update",
        `#${id} +${input.addDonationIds.length}/-${input.removeDonationIds.length} donations, ` +
          `+${input.linkCodes.length}/-${input.unlinkCodes.length} payments`,
      );
      return ctx.send({ ok: true });
    },

    async remove(ctx: Context) {
      const id = Number(ctx.params.id);
      if (!id || isNaN(id)) return ctx.badRequest("Invalid transfer ID");

      const result = await service.remove(id);
      if (!result.ok) {
        if (result.reason === "has-links") {
          ctx.status = 409;
          return ctx.send({
            error: {
              status: 409,
              name: "ConflictError",
              message:
                "This transfer still has donations or bank payments linked — unlink them first",
            },
          });
        }
        return ctx.notFound("Transfer not found");
      }

      await auditLog(ctx, "transfers.remove", String(id));
      return ctx.send({ ok: true });
    },
  };
};
