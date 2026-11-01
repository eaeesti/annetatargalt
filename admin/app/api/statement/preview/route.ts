import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../lib/api";

export async function POST(request: NextRequest) {
  return relay(
    await strapiAdmin("/api/admin-panel/statement/preview", {
      method: "POST",
      body: await request.formData(),
    }),
  );
}
