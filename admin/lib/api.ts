import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "./auth";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

/**
 * A request to the backend as the signed-in admin. Without a session it's
 * answered 401 here, and nothing goes to the backend.
 */
export async function strapiAdmin(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  return fetch(`${STRAPI_URL}${path}`, {
    ...options,
    headers: {
      // JSON goes as a string; a form's own type, with its boundary, is
      // fetch's to set.
      ...(typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

/** Statuses whose response has no body, which a Response can't be given. */
const BODILESS = new Set([204, 205, 304]);

/** A response from the backend, passed on to the browser as it came. */
export async function relay(res: Response): Promise<NextResponse> {
  if (BODILESS.has(res.status)) {
    return new NextResponse(null, { status: res.status });
  }
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
