import { strapiAdmin } from "../../../lib/api";
import { resolveOrgNames } from "../../../lib/orgs";
import {
  DonationsTable,
  type DonationRow,
  type Pagination,
} from "./_components/donations-table";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "id",
  "datetime",
  "amount",
  "finalized",
  "paymentMethod",
  "companyName",
]);

interface ListResponse {
  data: DonationRow[];
  pagination: Pagination;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default async function DonationsPage({
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

  const finalized = str(params.finalized);
  const dateFrom = str(params.dateFrom);
  const dateTo = str(params.dateTo);
  const hasCompany = str(params.hasCompany);
  const hasTransfer = str(params.hasTransfer);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDir,
    ...(finalized !== undefined && { finalized }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(hasCompany !== undefined && { hasCompany }),
    ...(hasTransfer !== undefined && { hasTransfer }),
  });

  const res = await strapiAdmin(`/api/admin-panel/donations/list?${qs}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Donations</h1>
        <p className="text-destructive">
          Failed to load donations ({res.status}). Check that Strapi is running.
        </p>
      </div>
    );
  }

  const { data, pagination } = (await res.json()) as ListResponse;

  const allOrgIds = [
    ...new Set(
      data.flatMap((d) =>
        d.organizationDonations.map((od) => od.organizationInternalId),
      ),
    ),
  ];
  const orgNamesMap = await resolveOrgNames(allOrgIds);
  const orgNames = Object.fromEntries(orgNamesMap);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Donations</h1>
      <DonationsTable
        data={data}
        pagination={pagination}
        orgNames={orgNames}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
}
