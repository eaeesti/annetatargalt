import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../lib/api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return relay(
    await strapiAdmin(`/api/admin-panel/donations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: await request.text(),
    }),
  );
}
