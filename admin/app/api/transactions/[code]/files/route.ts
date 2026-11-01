import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../../lib/api";

/** Attaches one PDF, sent as the `files` form field, to the bank line. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  return relay(
    await strapiAdmin(
      `/api/admin-panel/bank-transactions/${encodeURIComponent(code)}/files`,
      { method: "POST", body: await request.formData() },
    ),
  );
}
