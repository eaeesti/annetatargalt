import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { readFileSync } from "node:fs";
import { createStatementService } from "../services/statement";
import { auditLog } from "../utils/audit-log";

type UploadedFile = { filepath?: string; path?: string; size?: number };

function firstFile(ctx: Context): UploadedFile | null {
  const files = (
    ctx.request as { files?: Record<string, UploadedFile | UploadedFile[]> }
  ).files;
  if (!files) return null;
  const entry = Object.values(files)[0];
  const file = Array.isArray(entry) ? entry[0] : entry;
  return file ?? null;
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const service = createStatementService(strapi);

  return {
    async preview(ctx: Context) {
      const file = firstFile(ctx);
      const path = file?.filepath ?? file?.path;
      if (!path) {
        return ctx.badRequest("Upload the LHV statement CSV as a file");
      }

      let result;
      try {
        result = await service.preview(readFileSync(path));
      } catch (err) {
        return ctx.badRequest(err instanceof Error ? err.message : String(err));
      }

      await auditLog(ctx, "statement.preview");
      return ctx.send(result);
    },

    async apply(ctx: Context) {
      const body = ctx.request.body as Partial<{
        reconcile: unknown[];
        recurringImports: unknown[];
        cardPayoutAssignments: unknown[];
        ignore: unknown[];
      }>;

      const payload = {
        reconcile: Array.isArray(body.reconcile) ? body.reconcile : [],
        recurringImports: Array.isArray(body.recurringImports)
          ? body.recurringImports
          : [],
        cardPayoutAssignments: Array.isArray(body.cardPayoutAssignments)
          ? body.cardPayoutAssignments
          : [],
        ignore: Array.isArray(body.ignore) ? body.ignore : [],
      };

      const user = ctx.state.user as { email?: string } | undefined;

      let summary;
      try {
        summary = await service.apply(
          payload as never,
          user?.email ?? "unknown",
        );
      } catch (err) {
        return ctx.badRequest(err instanceof Error ? err.message : String(err));
      }

      await auditLog(
        ctx,
        "statement.apply",
        `created=${summary.created} reconciled=${summary.reconciled} ignored=${summary.ignored}`,
      );
      return ctx.send(summary);
    },
  };
};
