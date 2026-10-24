import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "../../../../lib/auth";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

async function forward(
  method: "GET" | "DELETE",
  id: string,
): Promise<Response> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return fetch(
    `${STRAPI_URL}/api/admin-panel/bank-transaction-files/${encodeURIComponent(id)}`,
    { method, headers: { Authorization: `Bearer ${token}` } },
  );
}

/** The PDF itself, to open in the browser. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await forward("GET", (await params).id);
  if (!res.ok) {
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  }
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Cache-Control": "private, no-store",
  });
  const disposition = res.headers.get("Content-Disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(res.body, { status: 200, headers });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await forward("DELETE", (await params).id);
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
