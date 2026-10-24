import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { readFile } from "node:fs/promises";
import { createBankTransactionFileService } from "../services/bank-transaction-file";
import { auditLog } from "../utils/audit-log";
import { currentUser } from "../utils/current-user";
import { inlineDisposition, MAX_PDF_BYTES } from "../../../../utils/pdf-file";

/**
 * The one file sent as the `files` form field. Strapi deletes its temporary
 * copy once the request is done.
 */
function uploadedFile(
  ctx: Context,
): { path: string; name: string | null; size: number } | null {
  const entry = ctx.request.files?.files;
  if (Array.isArray(entry) && entry.length !== 1) return null;
  const file = Array.isArray(entry) ? entry[0] : entry;
  if (!file?.filepath) return null;
  return {
    path: file.filepath,
    name: file.originalFilename ?? null,
    size: file.size,
  };
}

const fileId = (ctx: Context): number | null => {
  const id = Number(ctx.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const STORAGE_UNAVAILABLE = "File storage isn't set up on the server";
const MAX_MB = MAX_PDF_BYTES / 1024 / 1024;

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const service = createBankTransactionFileService(strapi);

  return {
    async upload(ctx: Context) {
      const code = String(ctx.params.code ?? "").trim();
      if (!code) return ctx.badRequest("Missing archiving code");
      const upload = uploadedFile(ctx);
      if (!upload) return ctx.badRequest("Send one PDF as the files field");
      // checked before reading it in, whatever the service checks after
      if (upload.size > MAX_PDF_BYTES) {
        return ctx.payloadTooLarge(`The file is larger than ${MAX_MB} MB`);
      }

      const result = await service.attach(
        code,
        { data: await readFile(upload.path), fileName: upload.name },
        currentUser(ctx)?.email ?? "unknown",
      );
      if (!result.ok) {
        switch (result.reason) {
          case "not-found":
            return ctx.notFound("Bank transaction not found");
          case "not-linked":
            return ctx.conflict(
              "Only a payment linked to a transfer can have files attached",
            );
          case "has-file":
            return ctx.conflict(
              "This payment already has a PDF. Remove it to attach another",
            );
          case "empty":
            return ctx.badRequest("The file is empty");
          case "too-large":
            return ctx.payloadTooLarge(`The file is larger than ${MAX_MB} MB`);
          case "not-pdf":
            return ctx.unsupportedMediaType("Only PDF files can be attached");
          case "storage-unavailable":
            return ctx.serviceUnavailable(STORAGE_UNAVAILABLE);
        }
      }

      await auditLog(
        ctx,
        "bankTransactionFiles.upload",
        `${code} #${result.file.id}`,
      );
      return ctx.created({ data: result.file });
    },

    async download(ctx: Context) {
      const id = fileId(ctx);
      if (!id) return ctx.badRequest("Invalid file id");

      const result = await service.open(id);
      if (!result.ok) {
        if (result.reason === "storage-unavailable") {
          return ctx.serviceUnavailable(STORAGE_UNAVAILABLE);
        }
        return ctx.notFound(
          result.reason === "missing"
            ? "The file is missing from the server"
            : "File not found",
        );
      }

      await auditLog(ctx, "bankTransactionFiles.download", String(id));
      ctx.set("Content-Type", "application/pdf");
      ctx.set("Content-Disposition", inlineDisposition(result.fileName));
      ctx.set("Cache-Control", "private, no-store");
      ctx.set("X-Content-Type-Options", "nosniff");
      ctx.body = result.data;
    },

    async remove(ctx: Context) {
      const id = fileId(ctx);
      if (!id) return ctx.badRequest("Invalid file id");

      const result = await service.remove(id);
      if (!result.ok) {
        return result.reason === "storage-unavailable"
          ? ctx.serviceUnavailable(STORAGE_UNAVAILABLE)
          : ctx.notFound("File not found");
      }

      await auditLog(
        ctx,
        "bankTransactionFiles.remove",
        `${result.archivingCode} #${id}`,
      );
      return ctx.send({ ok: true });
    },
  };
};
