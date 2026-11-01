import { NextResponse, type NextRequest } from "next/server";
import { emailPreferencesPath } from "@/utils/cms";
import { DEFAULT_LOCALE, isLocale } from "@/utils/locale";

/**
 * Where the links in our emails to a donor's settings go: on to the page
 * where they choose which emails to get, in the email's language, wherever
 * the CMS has it now. The donor's token is in the link's fragment, which
 * the browser keeps through the redirect, and never sends.
 */
export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale");
  return NextResponse.redirect(
    new URL(
      await emailPreferencesPath(isLocale(locale) ? locale : DEFAULT_LOCALE),
      request.url,
    ),
  );
}
