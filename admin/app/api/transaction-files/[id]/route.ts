import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../lib/api";

type Params = { params: Promise<{ id: string }> };

const fileUrl = (id: string) =>
  `/api/admin-panel/bank-transaction-files/${encodeURIComponent(id)}`;

/** The PDF itself, to open in the browser: passed on as bytes, not text. */
export async function GET(_req: NextRequest, { params }: Params) {
  const res = await strapiAdmin(fileUrl((await params).id));
  if (!res.ok) return relay(res);
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Cache-Control": "private, no-store",
  });
  const disposition = res.headers.get("Content-Disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(res.body, { status: 200, headers });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return relay(
    await strapiAdmin(fileUrl((await params).id), { method: "DELETE" }),
  );
}
