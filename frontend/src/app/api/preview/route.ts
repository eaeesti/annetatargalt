import { createHash, timingSafeEqual } from "node:crypto";
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

/** Whether the link was made by Strapi, which shares the secret with us. */
function isFromStrapi(secret: string | null): boolean {
  const expected = process.env.PREVIEW_SECRET;
  if (!expected || !secret) return false;
  // Hashed first, as timingSafeEqual needs both the same length
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(secret), hash(expected));
}

/**
 * Strapi's Preview button opens a page through here. A draft's link turns
 * on Next's draft mode, in which the site shows every document's latest
 * draft (utils/cms.ts); a published version's link, or the preview banner's,
 * turns it off. Either way it then goes on to the page.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const asked = params.get("path") ?? "/";
  // Only a path on this site, so the link can't send anyone elsewhere
  const path =
    asked.startsWith("/") && !asked.startsWith("//") && !asked.includes("\\")
      ? asked
      : "/";

  const mode = await draftMode();
  if (params.get("status") === "published") {
    mode.disable();
  } else if (isFromStrapi(params.get("secret"))) {
    mode.enable();
  } else {
    return new Response("This preview link isn't valid.", { status: 401 });
  }
  redirect(path);
}
