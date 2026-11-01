import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../lib/api";

type Params = { params: Promise<{ id: string }> };

async function forward(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return relay(
    await strapiAdmin(`/api/admin-panel/transfers/${encodeURIComponent(id)}`, {
      method: request.method,
      body: request.method === "PATCH" ? await request.text() : undefined,
    }),
  );
}

export { forward as GET, forward as PATCH, forward as DELETE };
