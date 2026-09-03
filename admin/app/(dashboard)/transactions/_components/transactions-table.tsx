"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
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

// ── Types ────────────────────────────────────────────────────────────────────

export type BankTransactionRow = {
  archivingCode: string;
  date: string | null;
  amount: number | null;
  description: string | null;
  counterpartyName: string | null;
  senderCode: string | null;
  category: string;
  grossAmount: number | null;
  feeAmount: number | null;
  note: string | null;
  linkedDonationCount: number;
  allocatedCents: number;
  linkedGrossCents: number;
  balanced: boolean;
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

const CATEGORIES = ["donation", "card-payout", "ignored", "undecided"] as const;
const PAGE_SIZES = [25, 50, 100, 250] as const;

const eur = (cents: number | null) =>
  cents == null ? "—" : `€${(cents / 100).toFixed(2)}`;

function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

function categoryVariant(
  c: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (c === "donation") return "default";
  if (c === "card-payout") return "secondary";
  if (c === "ignored") return "outline";
  return "destructive"; // undecided — needs attention
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: BankTransactionRow[];
  pagination: Pagination;
  sortBy: string;
  sortDir: "asc" | "desc";
  category: string | null;
}

export function TransactionsTable({
  data,
  pagination,
  sortBy,
  sortDir,
  category,
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

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col)
      return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3" />
    );
  }

  async function toggleRow(row: BankTransactionRow) {
    const code = row.archivingCode;
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
        const json = await res.json();
        setDetail((d) => ({
          ...d,
          [code]: { donations: json.data.donations },
        }));
      } catch {
        setDetail((d) => ({ ...d, [code]: "error" }));
      }
    }
  }

  async function saveEdit(code: string) {
    if (!edit) return;
    setSaving(true);
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
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message ?? "Failed to reclassify");
        return;
      }
      setExpanded(null);
      setEdit(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const FILTER_DEFS: FilterDef[] = [
    { type: "date-range", label: "Date", fromKey: "dateFrom", toKey: "dateTo" },
    { type: "text", label: "Search", key: "search" },
  ];
  const FILTER_KEYS = ["dateFrom", "dateTo", "search"];
  const filterParams = Object.fromEntries(
    FILTER_KEYS.filter((k) => searchParams.has(k)).map((k) => [
      k,
      searchParams.get(k)!,
    ]),
  );

  const colSpan = 8;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
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
              {c}
            </Button>
          ))}
        </div>
        <FilterBuilder
          filters={FILTER_DEFS}
          params={filterParams}
          onChange={pushUrl}
        />
        <p className="ml-auto text-sm text-muted-foreground">
          {pagination.total.toLocaleString()} lines
        </p>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>
                <button onClick={() => handleSort("date")}>
                  Date <SortIcon col="date" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => handleSort("counterpartyName")}>
                  Counterparty <SortIcon col="counterpartyName" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button onClick={() => handleSort("amount")}>
                  Amount <SortIcon col="amount" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => handleSort("category")}>
                  Category <SortIcon col="category" />
                </button>
              </TableHead>
              <TableHead className="text-right">Donations</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-center">OK</TableHead>
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
                      <TableCell className="whitespace-nowrap">
                        {fmtDate(row.date)}
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-xs truncate">
                          {row.counterpartyName ?? "—"}
                        </span>
                        <span className="block max-w-xs truncate text-xs text-muted-foreground">
                          {row.description}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {eur(row.amount)}
                        {row.category === "card-payout" &&
                          row.feeAmount != null && (
                            <span className="block text-xs text-muted-foreground">
                              fee {eur(row.feeAmount)}
                            </span>
                          )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={categoryVariant(row.category)}>
                          {row.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.linkedDonationCount || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.linkedDonationCount
                          ? eur(row.allocatedCents)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.linkedDonationCount === 0 ? (
                          <span className="text-muted-foreground">·</span>
                        ) : row.balanced ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <span className="text-destructive">✗</span>
                        )}
                      </TableCell>
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
                                  {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
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
                              <span className="text-xs text-muted-foreground">
                                code {row.archivingCode} · sender{" "}
                                {row.senderCode ?? "—"}
                                {row.grossAmount != null &&
                                  ` · gross ${eur(row.grossAmount)}`}
                              </span>
                            </div>

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
                                          <a
                                            className="font-mono hover:underline"
                                            href={`/donations/${dn.id}`}
                                          >
                                            #{dn.id}
                                          </a>
                                        </td>
                                        <td className="py-1 pr-3">
                                          {dn.donorName ?? "—"}
                                        </td>
                                        <td className="py-1 pr-3 text-right tabular-nums">
                                          {eur(dn.amount)}
                                        </td>
                                        <td className="py-1 pr-3 text-right tabular-nums">
                                          {dn.processorFeeCents != null
                                            ? eur(dn.processorFeeCents)
                                            : "—"}
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
                                          {dn.donationTransferId
                                            ? `#${dn.donationTransferId}`
                                            : "—"}
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

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <div className="flex gap-1">
            {PAGE_SIZES.map((size) => (
              <Button
                key={size}
                variant={pagination.pageSize === size ? "default" : "outline"}
                size="sm"
                className="h-7 w-10 px-0"
                onClick={() => pushUrl({ pageSize: String(size), page: "1" })}
              >
                {size}
              </Button>
            ))}
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
