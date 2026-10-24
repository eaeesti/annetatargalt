import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "../../../../../lib/auth";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

/** Attaches one PDF, sent as the `files` form field, to the bank line. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { code } = await params;

  const res = await fetch(
    `${STRAPI_URL}/api/admin-panel/bank-transactions/${encodeURIComponent(code)}/files`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: await request.formData(),
    },
  );

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
