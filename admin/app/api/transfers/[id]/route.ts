import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "../../../../lib/auth";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

async function forward(
  method: "GET" | "PATCH" | "DELETE",
  id: string,
  body?: string,
): Promise<NextResponse> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(
    `${STRAPI_URL}/api/admin-panel/transfers/${encodeURIComponent(id)}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forward("GET", id);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forward("PATCH", id, await request.text());
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forward("DELETE", id);
}
