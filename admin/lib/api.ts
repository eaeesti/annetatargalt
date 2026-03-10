import { cookies } from "next/headers";
import { COOKIE_NAME } from "./auth";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

export async function strapiAdmin(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  return fetch(`${STRAPI_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}
