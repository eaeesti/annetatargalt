import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../lib/api";

type Params = { params: Promise<{ code: string }> };

async function forward(request: NextRequest, { params }: Params) {
  const { code } = await params;
  return relay(
    await strapiAdmin(
      `/api/admin-panel/bank-transactions/${encodeURIComponent(code)}`,
      {
        method: request.method,
        body: request.method === "PATCH" ? await request.text() : undefined,
      },
    ),
  );
}

export { forward as GET, forward as PATCH };
