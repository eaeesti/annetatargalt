import type { Context } from "koa";

/**
 * The one file sent as the `files` form field, or null when there isn't
 * exactly one. Strapi deletes its temporary copy once the request is done.
 */
export function uploadedFile(
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
