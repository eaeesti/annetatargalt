import { strapiAdmin } from "../../../lib/api";
import {
  TransfersTable,
  type TransferRow,
  type Pagination,
} from "./_components/transfers-table";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "id",
  "datetime",
  "donationCount",
  "totalAmount",
]);

interface ListResponse {
  data: TransferRow[];
  pagination: Pagination;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const page = Math.max(1, Number(str(params.page) ?? 1));
  const pageSizeRaw = Number(str(params.pageSize) ?? 50);
  const pageSize = VALID_PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : 50;
  const sortByRaw = str(params.sortBy) ?? "datetime";
  const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "datetime";
  const sortDir =
    str(params.sortDir) === "asc" ? ("asc" as const) : ("desc" as const);

  const dateFrom = str(params.dateFrom);
  const dateTo = str(params.dateTo);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDir,
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  });

  const res = await strapiAdmin(`/api/admin-panel/transfers/list?${qs}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Transfers</h1>
        <p className="text-destructive">
          Failed to load transfers. Please try again later.
        </p>
      </div>
    );
  }

  const { data, pagination } = (await res.json()) as ListResponse;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transfers</h1>
      <TransfersTable
        data={data}
        pagination={pagination}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
}
