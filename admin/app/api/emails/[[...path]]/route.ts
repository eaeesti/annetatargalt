import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../lib/api";

type Params = { params: Promise<{ path?: string[] }> };

/** Every request of the Emails pages, passed on to the backend's /emails. */
async function forward(request: NextRequest, { params }: Params) {
  const { path = [] } = await params;
  const hasBody = request.method !== "GET" && request.method !== "DELETE";
  return relay(
    await strapiAdmin(
      `/api/admin-panel/emails${path.map((p) => `/${encodeURIComponent(p)}`).join("")}`,
      {
        method: request.method,
        body: hasBody ? await request.text() : undefined,
        cache: "no-store",
      },
    ),
  );
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
