import type { DonationRow } from "../app/(dashboard)/donations/_components/donations-table";
import type { DonorRow } from "../app/(dashboard)/donors/_components/donors-table";
import type { RecurringDonationRow } from "../app/(dashboard)/recurring-donations/_components/recurring-donations-table";
import type { BankTransactionRow } from "../app/(dashboard)/transactions/_components/transactions-table";
import type { TransferRow } from "../app/(dashboard)/transfers/_components/transfers-table";
import { strapiAdmin } from "./api";
import { type CsvColumn, day, euros, minute, toCsv } from "./csv";
import { donationStatus } from "./donation-status";
import { fetchOrgNameMap, fetchOrgs } from "./orgs";

/*
 * What each table's "Export CSV" button downloads: every row matching the
 * table's filters, in its sort order, with the columns the table can show,
 * hidden ones included. The backend logs each export.
 */

export type Exported =
  | { ok: true; csv: string }
  | { ok: false; status: number; message: string };

type Rows<Row> =
  | { ok: true; rows: Row[] }
  | { ok: false; status: number; message: string };

/** Every row the list endpoint at `path` has for the given sort and filters. */
async function listRows<Row>(
  path: string,
  params: URLSearchParams,
  filterKeys: string[],
): Promise<Rows<Row>> {
  const qs = new URLSearchParams({ export: "true" });
  for (const key of ["sortBy", "sortDir", ...filterKeys]) {
    const value = params.get(key);
    if (value) qs.set(key, value);
  }
  const res = await strapiAdmin(`${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) {
    return {
      ok: false,
      status: res.status === 401 || res.status === 403 ? res.status : 502,
      message: "Couldn't load the rows to export. Try again in a moment.",
    };
  }
  const { data, pagination } = (await res.json()) as {
    data: Row[];
    pagination: { total: number };
  };
  if (pagination.total > data.length) {
    return {
      ok: false,
      status: 413,
      message: `${pagination.total} rows match, more than one export can hold (${data.length}). Narrow the filters and try again.`,
    };
  }
  return { ok: true, rows: data };
}

function csvOf<Row>(rows: Rows<Row>, columns: CsvColumn<Row>[]): Exported {
  return rows.ok ? { ok: true, csv: toCsv(columns, rows.rows) } : rows;
}

const STATUS_LABELS = {
  finalized: "Finalized",
  pending: "Pending",
  cancelled: "Cancelled",
  active: "Active",
  stopped: "Stopped",
  neverStarted: "Never started",
};

const okLabel = (balanced: boolean | null) =>
  balanced === null ? null : balanced ? "OK" : "Not OK";

async function donations(params: URLSearchParams): Promise<Exported> {
  const [rows, orgNames] = await Promise.all([
    listRows<DonationRow>("/api/admin-panel/donations/list", params, [
      "finalized",
      "dateFrom",
      "dateTo",
      "hasCompany",
      "hasTransfer",
      "hasTransactionId",
      "transactionId",
      "amountMin",
      "amountMax",
    ]),
    fetchOrgNameMap(),
  ]);
  return csvOf(rows, [
    { header: "ID", value: (d) => d.id },
    { header: "Date", value: (d) => minute(d.datetime) },
    { header: "Amount (€)", value: (d) => euros(d.amount) },
    {
      header: "Status",
      value: (d) => STATUS_LABELS[donationStatus(d.finalized, d.datetime)],
    },
    { header: "Donor ID", value: (d) => d.donor?.id },
    { header: "First name", value: (d) => d.donor?.firstName },
    { header: "Last name", value: (d) => d.donor?.lastName },
    { header: "Email", value: (d) => d.donor?.email },
    {
      header: "Organizations",
      value: (d) =>
        d.organizationDonations
          .map(
            (od) =>
              `${orgNames.get(od.organizationInternalId) ?? od.organizationInternalId}: ${(od.amount / 100).toFixed(2)}`,
          )
          .join("; "),
    },
    { header: "Payment method", value: (d) => d.paymentMethod },
    { header: "Company", value: (d) => d.companyName },
    { header: "Company code", value: (d) => d.companyCode },
    { header: "Transaction ID", value: (d) => d.transactionId },
    { header: "Transfer ID", value: (d) => d.donationTransferId },
  ]);
}

async function donors(params: URLSearchParams): Promise<Exported> {
  const rows = await listRows<DonorRow>(
    "/api/admin-panel/donors/list",
    params,
    ["search", "recurringStatus"],
  );
  return csvOf(rows, [
    { header: "ID", value: (d) => d.id },
    { header: "First name", value: (d) => d.firstName },
    { header: "Last name", value: (d) => d.lastName },
    { header: "Email", value: (d) => d.email },
    { header: "Recurring", value: (d) => d.recurringDonor },
    { header: "Total donated (€)", value: (d) => euros(d.totalDonated) },
    { header: "Donations", value: (d) => d.donationCount },
    { header: "Last donation", value: (d) => day(d.lastDonationDate) },
  ]);
}

async function recurringDonations(params: URLSearchParams): Promise<Exported> {
  const rows = await listRows<RecurringDonationRow>(
    "/api/admin-panel/recurring-donations/list",
    params,
    [],
  );
  return csvOf(rows, [
    { header: "ID", value: (r) => r.id },
    { header: "Donor ID", value: (r) => r.donorId },
    { header: "First name", value: (r) => r.donorFirstName },
    { header: "Last name", value: (r) => r.donorLastName },
    { header: "Email", value: (r) => r.donorEmail },
    { header: "Company", value: (r) => r.companyName },
    { header: "Amount per month (€)", value: (r) => euros(r.amount) },
    { header: "Started", value: (r) => day(r.datetime) },
    { header: "Status", value: (r) => STATUS_LABELS[r.status] },
    { header: "Donations", value: (r) => r.donationCount },
    { header: "Last donation", value: (r) => day(r.lastDonationDate) },
  ]);
}

async function transfers(params: URLSearchParams): Promise<Exported> {
  const rows = await listRows<TransferRow>(
    "/api/admin-panel/transfers/list",
    params,
    ["dateFrom", "dateTo"],
  );
  return csvOf(rows, [
    { header: "ID", value: (t) => t.id },
    { header: "Date", value: (t) => day(t.datetime) },
    { header: "Notes", value: (t) => t.notes },
    { header: "Donations", value: (t) => t.donationCount },
    { header: "Total (€)", value: (t) => euros(t.totalAmount) },
    { header: "Card fees (€)", value: (t) => euros(t.cardFeeCents) },
    {
      header: "Card fees deducted (€)",
      value: (t) => euros(t.cardFeeDeductionCents),
    },
    {
      header: "Paid out (€)",
      value: (t) => (t.paymentCount ? euros(t.paidOutCents) : null),
    },
    { header: "Adjustment (€)", value: (t) => euros(t.adjustmentCents) },
    {
      header: "Residual (€)",
      value: (t) => (t.balanced === null ? null : euros(t.residualCents)),
    },
    { header: "OK", value: (t) => okLabel(t.balanced) },
  ]);
}

async function transactions(params: URLSearchParams): Promise<Exported> {
  const rows = await listRows<BankTransactionRow>(
    "/api/admin-panel/bank-transactions/list",
    params,
    [
      "category",
      "balanced",
      "dateFrom",
      "dateTo",
      "search",
      "amountMin",
      "amountMax",
    ],
  );
  // Amounts are stored as positive numbers; money out gets its minus here.
  const signed = (t: BankTransactionRow, cents: number | null) =>
    euros(cents === null ? null : t.direction === "D" ? -cents : cents);
  return csvOf(rows, [
    { header: "Archiving code", value: (t) => t.archivingCode },
    { header: "Date", value: (t) => t.date },
    {
      header: "In or out",
      value: (t) =>
        t.direction === "C" ? "In" : t.direction === "D" ? "Out" : null,
    },
    { header: "Amount (€)", value: (t) => signed(t, t.amount) },
    {
      header: "Category",
      value: (t) =>
        t.category === "card-payout" ? "Montonio payout" : t.category,
    },
    { header: "Counterparty", value: (t) => t.counterpartyName },
    { header: "Sender code", value: (t) => t.senderCode },
    { header: "Description", value: (t) => t.description },
    { header: "Gross (€)", value: (t) => euros(t.grossAmount) },
    { header: "Fee (€)", value: (t) => euros(t.feeAmount) },
    { header: "Note", value: (t) => t.note },
    { header: "Donations", value: (t) => t.linkedDonationCount },
    { header: "Allocated (€)", value: (t) => euros(t.allocatedCents) },
    { header: "Transfer ID", value: (t) => t.donationTransferId },
    { header: "OK", value: (t) => okLabel(t.balanced) },
  ]);
}

type OrgStat = {
  organizationInternalId: string;
  totalDonated: number;
  donationCount: number;
  lastDonationDate: string | null;
};

async function organizations(): Promise<Exported> {
  const [orgs, statsRes] = await Promise.all([
    fetchOrgs(),
    strapiAdmin("/api/admin-panel/organizations/stats", { cache: "no-store" }),
  ]);
  if (!statsRes.ok) {
    return {
      ok: false,
      status: 502,
      message: "Couldn't load the organizations. Try again in a moment.",
    };
  }
  const { data } = (await statsRes.json()) as { data: OrgStat[] };
  const stats = new Map(data.map((s) => [s.organizationInternalId, s]));
  // the table's own order: most donated first, those without donations last
  const rows = orgs
    .map((org) => ({ ...org, stat: stats.get(org.internalId) }))
    .sort(
      (a, b) => (b.stat?.totalDonated ?? -1) - (a.stat?.totalDonated ?? -1),
    );
  return {
    ok: true,
    csv: toCsv(
      [
        { header: "Internal ID", value: (o) => o.internalId },
        { header: "Name", value: (o) => o.title },
        { header: "Fund", value: (o) => o.fund },
        { header: "Active", value: (o) => o.active },
        {
          header: "Total donated (€)",
          value: (o) => euros(o.stat?.totalDonated),
        },
        { header: "Donations", value: (o) => o.stat?.donationCount },
        {
          header: "Last donation",
          value: (o) => day(o.stat?.lastDonationDate),
        },
      ],
      rows,
    ),
  };
}

/** Table name in the export URL → what it downloads. */
export const EXPORTS = new Map<
  string,
  (params: URLSearchParams) => Promise<Exported>
>([
  ["donations", donations],
  ["donors", donors],
  ["recurring-donations", recurringDonations],
  ["transfers", transfers],
  ["transactions", transactions],
  ["organizations", organizations],
]);
