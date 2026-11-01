import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../lib/api";

export async function GET(request: NextRequest) {
  return relay(
    await strapiAdmin(
      `/api/admin-panel/bank-transactions/summary?${request.nextUrl.searchParams}`,
    ),
  );
}
