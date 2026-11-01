import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../../lib/api";

/** A donor's email settings, changed by the team when the donor asks. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return relay(
    await strapiAdmin(
      `/api/admin-panel/donors/${encodeURIComponent(id)}/email-preferences`,
      { method: "PATCH", body: await request.text() },
    ),
  );
}
