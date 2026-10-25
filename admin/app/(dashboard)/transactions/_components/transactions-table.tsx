"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ExportCsvButton } from "../../../../components/export-csv-button";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { EntityLink } from "../../../../components/entity-link";
import { SortIcon } from "../../../../components/sort-icon";
import { donationHref, transferHref } from "../../../../lib/entity-links";
import {
  FilterBuilder,
  type FilterDef,
} from "../../../../components/filter-builder";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { ariaSort } from "../../../../lib/aria-sort";
import { readJson } from "../../../../lib/read-json";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../lib/failure-message";
import { ColumnPicker } from "../../../../components/column-picker";
import { useSavedColumnVisibility } from "../../../../hooks/use-saved-column-visibility";
import type { VisibilityState } from "@tanstack/react-table";

// ── Types ────────────────────────────────────────────────────────────────────

export type BankTransactionRow = {
  archivingCode: string;
  date: string | null;
  amount: number | null;
  description: string | null;
  counterpartyName: string | null;
  senderCode: string | null;
  category: string;
  /** "C" money in, "D" money out; null until a statement import says */
  direction: string | null;
  grossAmount: number | null;
  feeAmount: number | null;
  note: string | null;
  donationTransferId: number | null;
  linkedDonationCount: number;
  allocatedCents: number;
  linkedGrossCents: number;
  balanced: boolean | null;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

type LinkedDonation = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  processorFeeCents: number | null;
  transactionMatchSource: string | null;
  donationTransferId: number | null;
  donorName: string | null;
  orgDonations: {
    organizationInternalId: string;
    organizationName: string;
    amount: number;
  }[];
};

const CATEGORIES = [
  "donation",
  "card-payout",
  "outgoing",
  "ignored",
  "undecided",
  "unimported",
] as const;
/** categories an operator can set a row to via the drawer (not 'unimported') */
const RECLASSIFY_CATEGORIES = CATEGORIES.filter((c) => c !== "unimported");
const PAGE_SIZES = [25, 50, 100, 250, "all"] as const;
const BALANCED_FILTERS = [
  { value: "ok", label: "✓ OK" },
  { value: "not-ok", label: "✗ Not OK" },
  { value: "unknown", label: "· Unknown" },
] as const;

const eur = (cents: number | null) =>
  typeof cents === "number" ? `€${(cents / 100).toFixed(2)}` : "—";

function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

/**
 * Montonio pays out bank-link payments in the same batches as card payments,
 * fee-free, so "card-payout" rows are really Montonio payouts. Only the label
 * says so; the stored category keeps its name.
 */
/** The columns someone can show or hide; the expand arrow always shows. */
const COLUMNS = [
  { id: "date", label: "Date" },
  { id: "counterparty", label: "Counterparty" },
  { id: "amount", label: "Amount" },
  { id: "category", label: "Category" },
  { id: "donations", label: "Donations" },
  { id: "allocated", label: "Allocated" },
  { id: "transfer", label: "Transfer" },
  { id: "ok", label: "OK" },
];

// Every column starts shown on a wider screen.
const NO_HIDDEN_COLUMNS: VisibilityState = {};

// A phone shows when, how much, what kind of line and whether it ties out.
const PHONE_HIDDEN: VisibilityState = {
  counterparty: false,
  donations: false,
  allocated: false,
  transfer: false,
};

function categoryLabel(c: string): string {
  return c === "card-payout" ? "Montonio payout" : c;
}

function categoryVariant(
  c: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (c === "donation") return "default";
  if (c === "card-payout" || c === "outgoing") return "secondary";
  if (c === "ignored" || c === "unimported") return "outline";
  return "destructive"; // undecided — needs attention
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: BankTransactionRow[];
  pagination: Pagination;
  sortBy: string;
  sortDir: "asc" | "desc";
  category: string | null;
  balanced: string | null;
}

export function TransactionsTable({
  data,
  pagination,
  sortBy,
  sortDir,
  category,
  balanced,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<
    Record<string, { donations: LinkedDonation[] } | "loading" | "error">
  >({});
  const [edit, setEdit] = useState<{ category: string; note: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function pushUrl(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) sp.delete(k);
      else sp.set(k, v);
    }
    router.push(`/transactions?${sp.toString()}`);
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      pushUrl({ sortDir: sortDir === "asc" ? "desc" : "asc", page: "1" });
    } else {
      pushUrl({ sortBy: col, sortDir: "desc", page: "1" });
    }
  }

  async function toggleRow(row: BankTransactionRow) {
    const code = row.archivingCode;
    setSaveError(null);
    if (expanded === code) {
      setExpanded(null);
      setEdit(null);
      return;
    }
    setExpanded(code);
    setEdit({ category: row.category, note: row.note ?? "" });
    if (!detail[code] || detail[code] === "error") {
      setDetail((d) => ({ ...d, [code]: "loading" }));
      try {
        const res = await fetch(
          `/api/transactions/${encodeURIComponent(code)}`,
        );
        if (!res.ok) throw new Error();
        const { data } = await readJson<{
          data: { donations: LinkedDonation[] };
        }>(res);
        setDetail((d) => ({
          ...d,
          [code]: { donations: data.donations },
        }));
      } catch {
        setDetail((d) => ({ ...d, [code]: "error" }));
      }
    }
  }

  async function saveEdit(code: string) {
    if (!edit) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: edit.category,
          note: edit.note || null,
        }),
      });
      if (!res.ok) {
        setSaveError(await failureMessage(res, "Couldn't save the change."));
        return;
      }
      setExpanded(null);
      setEdit(null);
      router.refresh();
    } catch {
      setSaveError(CONNECTION_FAILED);
    } finally {
      setSaving(false);
    }
  }

  const FILTER_DEFS: FilterDef[] = [
    { type: "date-range", label: "Date", fromKey: "dateFrom", toKey: "dateTo" },
    { type: "text", label: "Search", key: "search" },
    {
      type: "number-range",
      label: "Amount",
      fromKey: "amountMin",
      toKey: "amountMax",
      unit: "€",
    },
  ];
  const FILTER_KEYS = [
    "dateFrom",
    "dateTo",
    "search",
    "amountMin",
    "amountMax",
  ];
  const filterParams: Record<string, string> = {};
  for (const k of FILTER_KEYS) {
    const value = searchParams.get(k);
    if (value !== null) filterParams[k] = value;
  }

  const {
    columnVisibility,
    setColumnVisible,
    resetColumnVisibility,
    isDefault,
  } = useSavedColumnVisibility("transactions", NO_HIDDEN_COLUMNS, PHONE_HIDDEN);
  const show = (id: string) => columnVisibility[id] !== false;
  // the expand arrow, plus every column that's shown
  const colSpan = 1 + COLUMNS.filter((column) => show(column.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          <Button
            variant={!category ? "default" : "outline"}
            size="sm"
            className="h-7"
            onClick={() => pushUrl({ category: undefined, page: "1" })}
          >
            All
          </Button>
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={category === c ? "default" : "outline"}
              size="sm"
              className="h-7"
              onClick={() => pushUrl({ category: c, page: "1" })}
            >
              {categoryLabel(c)}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {BALANCED_FILTERS.map((b) => (
            <Button
              key={b.value}
              variant={balanced === b.value ? "default" : "outline"}
              size="sm"
              className="h-7"
              onClick={() =>
                pushUrl({
                  balanced: balanced === b.value ? undefined : b.value,
                  page: "1",
                })
              }
            >
              {b.label}
            </Button>
          ))}
        </div>
        <FilterBuilder
          filters={FILTER_DEFS}
          params={filterParams}
          onChange={(u) => pushUrl({ ...u, page: "1" })}
        />
        <p className="ml-auto text-sm text-muted-foreground">
          {pagination.total.toLocaleString()} lines
        </p>
        <ExportCsvButton
          table="transactions"
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <ColumnPicker
          columns={COLUMNS.map((column) => ({
            ...column,
            visible: show(column.id),
          }))}
          onToggle={setColumnVisible}
          isDefault={isDefault}
          onReset={resetColumnVisibility}
        />
      </div>

      <div className="overflow-hidden rounded-md border bg-background">
        <Table stickyHeader>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              {show("date") && (
                <TableHead aria-sort={ariaSort("date", sortBy, sortDir)}>
                  <button
                    className="inline-flex items-center"
                    onClick={() => handleSort("date")}
                  >
                    Date{" "}
                    <SortIcon col="date" sortBy={sortBy} sortDir={sortDir} />
                  </button>
                </TableHead>
              )}
              {show("counterparty") && (
                <TableHead
                  aria-sort={ariaSort("counterpartyName", sortBy, sortDir)}
                >
                  <button
                    className="inline-flex items-center"
                    onClick={() => handleSort("counterpartyName")}
                  >
                    Counterparty{" "}
                    <SortIcon
                      col="counterpartyName"
                      sortBy={sortBy}
                      sortDir={sortDir}
                    />
                  </button>
                </TableHead>
              )}
              {show("amount") && (
                <TableHead
                  className="text-right"
                  aria-sort={ariaSort("amount", sortBy, sortDir)}
                >
                  <button
                    className="inline-flex items-center"
                    onClick={() => handleSort("amount")}
                  >
                    Amount{" "}
                    <SortIcon col="amount" sortBy={sortBy} sortDir={sortDir} />
                  </button>
                </TableHead>
              )}
              {show("category") && (
                <TableHead aria-sort={ariaSort("category", sortBy, sortDir)}>
                  <button
                    className="inline-flex items-center"
                    onClick={() => handleSort("category")}
                  >
                    Category{" "}
                    <SortIcon
                      col="category"
                      sortBy={sortBy}
                      sortDir={sortDir}
                    />
                  </button>
                </TableHead>
              )}
              {show("donations") && (
                <TableHead className="text-right">Donations</TableHead>
              )}
              {show("allocated") && (
                <TableHead className="text-right">Allocated</TableHead>
              )}
              {show("transfer") && <TableHead>Transfer</TableHead>}
              {show("ok") && <TableHead className="text-center">OK</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="py-8 text-center text-muted-foreground"
                >
                  No bank transactions.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const isOpen = expanded === row.archivingCode;
                const d = detail[row.archivingCode];
                return (
                  <Fragment key={row.archivingCode}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleRow(row)}
                    >
                      <TableCell>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4 opacity-40" />
                        )}
                      </TableCell>
                      {show("date") && (
                        <TableCell className="whitespace-nowrap">
                          {fmtDate(row.date)}
                        </TableCell>
                      )}
                      {show("counterparty") && (
                        // Takes whatever width the other columns leave
                        // (max-w-0 keeps long text from widening it), so
                        // the text is cut only where the table ends.
                        <TableCell className="w-full max-w-0 min-w-48">
                          <span
                            className="block truncate"
                            title={row.counterpartyName ?? undefined}
                          >
                            {row.counterpartyName ?? "—"}
                          </span>
                          <span
                            className="block truncate text-xs text-muted-foreground"
                            title={row.description ?? undefined}
                          >
                            {row.description}
                          </span>
                        </TableCell>
                      )}
                      {show("amount") && (
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {row.direction === "D" && "−"}
                          {eur(row.amount)}
                          {row.category === "card-payout" &&
                            typeof row.feeAmount === "number" && (
                              <span className="block text-xs text-muted-foreground">
                                fee {eur(row.feeAmount)}
                              </span>
                            )}
                        </TableCell>
                      )}
                      {show("category") && (
                        <TableCell>
                          <Badge variant={categoryVariant(row.category)}>
                            {categoryLabel(row.category)}
                          </Badge>
                        </TableCell>
                      )}
                      {show("donations") && (
                        <TableCell className="text-right tabular-nums">
                          {row.linkedDonationCount || "—"}
                        </TableCell>
                      )}
                      {show("allocated") && (
                        <TableCell className="text-right tabular-nums">
                          {row.linkedDonationCount
                            ? eur(row.allocatedCents)
                            : "—"}
                        </TableCell>
                      )}
                      {show("transfer") && (
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {row.donationTransferId ? (
                            <EntityLink
                              href={transferHref(row.donationTransferId)}
                              stopRowClick
                            >
                              #{row.donationTransferId}
                            </EntityLink>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {show("ok") && (
                        <TableCell className="text-center">
                          {typeof row.balanced !== "boolean" ? (
                            <span className="text-muted-foreground">·</span>
                          ) : row.balanced ? (
                            <span className="text-emerald-600">✓</span>
                          ) : (
                            <span className="text-destructive">✗</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>

                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={colSpan} className="bg-muted/30">
                          <div className="space-y-3 p-2">
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="text-xs">
                                <span className="mb-1 block text-muted-foreground">
                                  Category
                                </span>
                                <select
                                  className="rounded border bg-background px-2 py-1 text-sm"
                                  value={edit?.category ?? row.category}
                                  onChange={(e) =>
                                    setEdit((p) => ({
                                      category: e.target.value,
                                      note: p?.note ?? row.note ?? "",
                                    }))
                                  }
                                >
                                  {RECLASSIFY_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                      {categoryLabel(c)}
                                    </option>
                                  ))}
                                  {row.category === "unimported" && (
                                    <option value="unimported">
                                      unimported
                                    </option>
                                  )}
                                </select>
                              </label>
                              <label className="flex-1 text-xs">
                                <span className="mb-1 block text-muted-foreground">
                                  Note
                                </span>
                                <Input
                                  value={edit?.note ?? ""}
                                  onChange={(e) =>
                                    setEdit((p) => ({
                                      category: p?.category ?? row.category,
                                      note: e.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <Button
                                size="sm"
                                disabled={
                                  saving ||
                                  (edit?.category === row.category &&
                                    (edit?.note ?? "") === (row.note ?? ""))
                                }
                                onClick={() => saveEdit(row.archivingCode)}
                              >
                                {saving ? "Saving…" : "Save"}
                              </Button>
                              {saveError && (
                                <span
                                  role="alert"
                                  className="text-xs text-destructive"
                                >
                                  {saveError}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                code {row.archivingCode} · sender{" "}
                                {row.senderCode ?? "—"}
                                {typeof row.grossAmount === "number" &&
                                  ` · gross ${eur(row.grossAmount)}`}
                              </span>
                            </div>

                            {row.category === "outgoing" && (
                              <p className="text-xs text-muted-foreground">
                                {row.donationTransferId ? (
                                  <>
                                    Paid out in{" "}
                                    <EntityLink
                                      href={transferHref(
                                        row.donationTransferId,
                                      )}
                                      newTab
                                    >
                                      transfer #{row.donationTransferId}
                                    </EntityLink>
                                  </>
                                ) : (
                                  "Not linked to a transfer round — link it from the transfer's page."
                                )}
                              </p>
                            )}

                            {d === "loading" && (
                              <p className="text-xs text-muted-foreground">
                                Loading linked donations…
                              </p>
                            )}
                            {d === "error" && (
                              <p className="text-xs text-destructive">
                                Failed to load linked donations.
                              </p>
                            )}
                            {d &&
                              d !== "loading" &&
                              d !== "error" &&
                              (d.donations.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No donations linked to this code.
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead className="text-muted-foreground">
                                    <tr className="text-left">
                                      <th className="py-1 pr-3">Donation</th>
                                      <th className="py-1 pr-3">Donor</th>
                                      <th className="py-1 pr-3 text-right">
                                        Amount
                                      </th>
                                      <th className="py-1 pr-3 text-right">
                                        Card fee
                                      </th>
                                      <th className="py-1 pr-3">Split</th>
                                      <th className="py-1">Transfer</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {d.donations.map((dn) => (
                                      <tr
                                        key={dn.id}
                                        className="border-t border-border/50"
                                      >
                                        <td className="py-1 pr-3">
                                          <EntityLink
                                            href={donationHref(dn.id)}
                                            newTab
                                            className="font-mono hover:underline"
                                          >
                                            #{dn.id}
                                          </EntityLink>
                                        </td>
                                        <td className="py-1 pr-3">
                                          {dn.donorName ?? "—"}
                                        </td>
                                        <td className="py-1 pr-3 text-right tabular-nums">
                                          {eur(dn.amount)}
                                        </td>
                                        <td className="py-1 pr-3 text-right tabular-nums">
                                          {eur(dn.processorFeeCents)}
                                        </td>
                                        <td className="py-1 pr-3">
                                          {dn.orgDonations
                                            .map(
                                              (o) =>
                                                `${o.organizationName}: ${eur(o.amount)}`,
                                            )
                                            .join(", ")}
                                        </td>
                                        <td className="py-1">
                                          {dn.donationTransferId ? (
                                            <EntityLink
                                              href={transferHref(
                                                dn.donationTransferId,
                                              )}
                                              newTab
                                            >
                                              #{dn.donationTransferId}
                                            </EntityLink>
                                          ) : (
                                            "—"
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <div className="flex gap-1">
            {PAGE_SIZES.map((size) => {
              const active =
                size === "all"
                  ? pagination.pageSize === 0
                  : pagination.pageSize === size;
              return (
                <Button
                  key={size}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="h-7 min-w-10 px-2"
                  onClick={() => pushUrl({ pageSize: String(size), page: "1" })}
                >
                  {size === "all" ? "All" : size}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pageCount || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => pushUrl({ page: String(pagination.page - 1) })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.pageCount}
            onClick={() => pushUrl({ page: String(pagination.page + 1) })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
