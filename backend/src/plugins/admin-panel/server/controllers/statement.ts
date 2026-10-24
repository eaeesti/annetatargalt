import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { readFileSync } from "node:fs";
import { createStatementService } from "../services/statement";
import { auditLog } from "../utils/audit-log";
import { currentUser } from "../utils/current-user";

/** Where the uploaded statement was saved, if a file came with the request. */
function uploadedPath(ctx: Context): string | null {
  const files = ctx.request.files;
  if (!files) return null;
  const entry = Object.values(files)[0];
  const file = Array.isArray(entry) ? entry[0] : entry;
  return file?.filepath ?? null;
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const service = createStatementService(strapi);

  return {
    async preview(ctx: Context) {
      const path = uploadedPath(ctx);
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
      const user = currentUser(ctx);

      // the service checks the request's shape, and a malformed one throws
      let summary;
      try {
        summary = await service.apply(
          ctx.request.body,
          user?.email ?? "unknown",
        );
      } catch (err) {
        return ctx.badRequest(err instanceof Error ? err.message : String(err));
      }

      await auditLog(
        ctx,
        "statement.apply",
        `created=${summary.created} reconciled=${summary.reconciled} ignored=${summary.ignored} recorded=${summary.recorded}`,
      );
      return ctx.send(summary);
    },
  };
};
