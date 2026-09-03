import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "../../../lib/auth";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

export async function GET(request: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const qs = request.nextUrl.searchParams.toString();
  const res = await fetch(
    `${STRAPI_URL}/api/admin-panel/bank-transactions/list?${qs}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
