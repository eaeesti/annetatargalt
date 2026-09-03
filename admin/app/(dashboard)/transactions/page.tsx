import { strapiAdmin } from "../../../lib/api";
import {
  TransactionsTable,
  type BankTransactionRow,
  type Pagination,
} from "./_components/transactions-table";
import {
  MoneyFlowSummary,
  type MoneyFlow,
} from "./_components/money-flow-summary";

const VALID_PAGE_SIZES = [25, 50, 100, 250];
const VALID_SORT_COLS = new Set([
  "date",
  "amount",
  "category",
  "counterpartyName",
  "importedAt",
]);
const VALID_CATEGORIES = new Set([
  "donation",
  "card-payout",
  "outgoing",
  "ignored",
  "undecided",
]);

interface ListResponse {
  data: BankTransactionRow[];
  pagination: Pagination;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const page = Math.max(1, Number(str(params.page) ?? 1));
  const pageSizeParam = str(params.pageSize) ?? "50";
  const pageSize =
    pageSizeParam === "all"
      ? "all"
      : VALID_PAGE_SIZES.includes(Number(pageSizeParam))
        ? String(Number(pageSizeParam))
        : "50";
  const sortByRaw = str(params.sortBy) ?? "date";
  const sortBy = VALID_SORT_COLS.has(sortByRaw) ? sortByRaw : "date";
  const sortDir = str(params.sortDir) === "asc" ? "asc" : "desc";

  const category = VALID_CATEGORIES.has(str(params.category) ?? "")
    ? str(params.category)
    : undefined;
  const dateFrom = str(params.dateFrom);
  const dateTo = str(params.dateTo);
  const search = str(params.search);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDir,
    ...(category && { category }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(search && { search }),
  });

  const [listRes, summaryRes] = await Promise.all([
    strapiAdmin(`/api/admin-panel/bank-transactions/list?${qs}`, {
      cache: "no-store",
    }),
    strapiAdmin(
      `/api/admin-panel/bank-transactions/summary?${new URLSearchParams({
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      })}`,
      { cache: "no-store" },
    ),
  ]);

  if (!listRes.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-destructive">
          Failed to load bank transactions. Please try again later.
        </p>
      </div>
    );
  }

  const { data, pagination } = (await listRes.json()) as ListResponse;
  const summary = summaryRes.ok
    ? ((await summaryRes.json()) as MoneyFlow)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Every credit line from an imported bank statement, and whether the
          money is accounted for.
        </p>
      </div>

      {summary && <MoneyFlowSummary summary={summary} />}

      <TransactionsTable
        data={data}
        pagination={pagination}
        sortBy={sortBy}
        sortDir={sortDir as "asc" | "desc"}
        category={category ?? null}
      />
    </div>
  );
}
