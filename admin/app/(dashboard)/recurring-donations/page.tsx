import Link from "next/link";
import { strapiAdmin } from "../../../lib/api";
import {
  RecurringDonationsTable,
  type RecurringDonationRow,
  type Pagination,
} from "./_components/recurring-donations-table";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "id",
  "active",
  "amount",
  "datetime",
  "donorLastName",
  "donationCount",
  "lastDonationDate",
]);

interface ListResponse {
  data: RecurringDonationRow[];
  pagination: Pagination;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default async function RecurringDonationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const page = Math.max(1, Number(str(params.page) ?? 1));
  const pageSizeRaw = Number(str(params.pageSize) ?? 50);
  const pageSize = VALID_PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : 50;
  const sortByRaw = str(params.sortBy) ?? "id";
  const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "id";
  const sortDir =
    str(params.sortDir) === "desc" ? ("desc" as const) : ("asc" as const);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDir,
  });

  const res = await strapiAdmin(
    `/api/admin-panel/recurring-donations/list?${qs}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Recurring Donations</h1>
        <p className="text-destructive">
          Failed to load recurring donations ({res.status}). Check that Strapi
          is running.
        </p>
      </div>
    );
  }

  const { data, pagination } = (await res.json()) as ListResponse;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recurring Donations</h1>
        <Link
          href="/recurring-donations/grid"
          className="text-sm text-muted-foreground hover:text-foreground border rounded-md px-3 py-1.5"
        >
          Grid view →
        </Link>
      </div>
      <RecurringDonationsTable
        data={data}
        pagination={pagination}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
}
