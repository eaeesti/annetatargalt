import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { emailPreferencesPath } from "@/utils/cms";
import { DEFAULT_LOCALE, isLocale } from "@/utils/locale";

/**
 * Where the links in our emails to a donor's settings go: on to the page
 * where they choose which emails to get, in the email's language, wherever
 * the CMS has it now. The donor's token is in the link's fragment, which
 * the browser keeps through the redirect, and never sends.
 *
 * It goes on by path alone, as the preview does: behind the proxy, the
 * request's own address is the server's, not the site's.
 */
export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale");
  redirect(
    await emailPreferencesPath(isLocale(locale) ? locale : DEFAULT_LOCALE),
  );
}
