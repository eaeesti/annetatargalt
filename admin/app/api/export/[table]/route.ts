import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "../../../../lib/auth";
import { EXPORTS } from "../../../../lib/exports";
import { currentDay } from "../../../../lib/dates";

/** A table's rows as a CSV download, e.g. /api/export/donations?sortBy=…&dateFrom=… */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> },
) {
  if (!(await cookies()).get(COOKIE_NAME)?.value) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { table } = await params;
  const exportTable = EXPORTS.get(table);
  if (!exportTable) {
    return NextResponse.json({ error: "No such table" }, { status: 404 });
  }

  const result = await exportTable(request.nextUrl.searchParams);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.status },
    );
  }

  const today = currentDay();
  return new NextResponse(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${table}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
