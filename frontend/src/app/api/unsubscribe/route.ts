import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { emailPreferencesPath } from "@/utils/cms";
import { DEFAULT_LOCALE, isLocale } from "@/utils/locale";
import { getStrapiURL } from "@/utils/strapi";

/**
 * A mail client's own unsubscribe button for an email from us. The link in
 * the email's header has the donor's token and the kind of email, and the
 * client posts to it (RFC 8058) without opening anything: this passes it on
 * to the backend, which turns that kind of email off.
 *
 * A link that isn't ours is a 404. When the backend fails or can't be
 * reached, it's a 503, for the client to try again later, and a line in the
 * log, without the token.
 */
export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let failure: string;
  try {
    const response = await fetch(
      getStrapiURL("/api/email-preferences/unsubscribe"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.get("token"),
          kind: params.get("kind"),
        }),
      },
    );
    if (response.ok || response.status === 404) {
      return new NextResponse(null, { status: response.ok ? 200 : 404 });
    }
    failure = `the backend answered ${response.status}`;
  } catch (error) {
    failure = String(error);
  }
  console.error(`A one-click unsubscribe failed: ${failure}`);
  return new NextResponse(null, { status: 503 });
}

/**
 * Someone who opens the link instead goes to the page where they choose
 * which emails to get, in the email's language, by path alone, as in
 * ../email-settings. The token goes in the fragment, as in the emails' own
 * links, so it isn't sent again.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locale = params.get("locale");
  const page = await emailPreferencesPath(
    isLocale(locale) ? locale : DEFAULT_LOCALE,
  );
  const token = params.get("token") ?? "";
  redirect(`${page}#${new URLSearchParams({ token })}`);
}
