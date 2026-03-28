import { strapiAdmin } from "../../../lib/api";
import {
  DonorsTable,
  type DonorRow,
  type Pagination,
} from "./_components/donors-table";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "id",
  "lastName",
  "email",
  "recurringDonor",
  "totalDonated",
  "donationCount",
  "lastDonationDate",
]);

interface ListResponse {
  data: DonorRow[];
  pagination: Pagination;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default async function DonorsPage({
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

  const search = str(params.search);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDir,
    ...(search && { search }),
  });

  const res = await strapiAdmin(`/api/admin-panel/donors/list?${qs}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Donors</h1>
        <p className="text-destructive">
          Failed to load donors. Please try again later.
        </p>
      </div>
    );
  }

  const { data, pagination } = (await res.json()) as ListResponse;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Donors</h1>
      <DonorsTable
        data={data}
        pagination={pagination}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
}
