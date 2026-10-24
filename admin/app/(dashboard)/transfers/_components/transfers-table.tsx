"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ColumnPicker } from "../../../../components/column-picker";
import { ExportCsvButton } from "../../../../components/export-csv-button";
import { SortIcon } from "../../../../components/sort-icon";
import { useSavedColumnVisibility } from "../../../../hooks/use-saved-column-visibility";
import { Button } from "../../../../components/ui/button";
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
import { formatDate } from "../../../../lib/dates";
import { LinkedTableRow } from "../../../../components/linked-row";
import { EntityLink } from "../../../../components/entity-link";
import { transferHref } from "../../../../lib/entity-links";
import { useRememberListUrl } from "../../../../components/remembered-link";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TransferRow = {
  id: number;
  datetime: string;
  notes: string | null;
  donationCount: number | null;
  totalAmount: number | null;
  owedCents: number | null;
  /** the round's card fees, and how much of them comes off the tip organization's share */
  cardFeeCents: number | null;
  cardFeeDeductionCents: number | null;
  deductCardFees: boolean;
  paidOutCents: number | null;
  paymentCount: number | null;
  adjustmentCents: number | null;
  /** owed still not accounted for by the linked payments and the adjustment */
  residualCents: number | null;
  balanced: boolean | null;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(cents: number | null): string {
  if (cents == null) return "—";
  return `€${(cents / 100).toFixed(2)}`;
}

/** An amount that can go either way, with a proper minus sign. */
function formatSigned(cents: number): string {
  return `${cents < 0 ? "−" : ""}€${(Math.abs(cents) / 100).toFixed(2)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TransfersTableProps {
  data: TransferRow[];
  pagination: Pagination;
  sortBy: string;
  sortDir: "asc" | "desc";
}

const PAGE_SIZES = [25, 50, 100, 250] as const;

const DEFAULT_COLUMNS: VisibilityState = {};

export function TransfersTable({
  data,
  pagination,
  sortBy,
  sortDir,
}: TransfersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  useRememberListUrl("/transfers");

  const {
    columnVisibility,
    onColumnVisibilityChange,
    resetColumnVisibility,
    isDefault,
  } = useSavedColumnVisibility("transfers", DEFAULT_COLUMNS);

  function pushUrl(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) sp.delete(key);
      else sp.set(key, value);
    }
    router.push(`/transfers?${sp.toString()}`);
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      pushUrl({ sortDir: sortDir === "asc" ? "desc" : "asc", page: "1" });
    } else {
      // Default to desc for amount/count columns, asc for others
      const defaultDesc = col === "totalAmount" || col === "donationCount";
      pushUrl({
        sortBy: col,
        sortDir: defaultDesc ? "desc" : "asc",
        page: "1",
      });
    }
  }

  function SortableHeader({
    col,
    children,
  }: {
    col: string;
    children: React.ReactNode;
  }) {
    return (
      <button
        className="flex items-center font-medium hover:text-foreground"
        onClick={() => handleSort(col)}
      >
        {children}
        <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
      </button>
    );
  }

  const sorting: SortingState = [{ id: sortBy, desc: sortDir === "desc" }];

  const columns = useMemo<ColumnDef<TransferRow>[]>(
    () => [
      {
        id: "id",
        accessorKey: "id",
        header: () => <SortableHeader col="id">ID</SortableHeader>,
        cell: ({ row }) => (
          <EntityLink
            href={transferHref(row.original.id)}
            className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            #{row.original.id}
          </EntityLink>
        ),
      },
      {
        id: "datetime",
        accessorKey: "datetime",
        header: () => <SortableHeader col="datetime">Date</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {formatDate(row.original.datetime)}
          </span>
        ),
      },
      {
        id: "notes",
        accessorKey: "notes",
        header: "Notes",
        // Takes whatever width the other columns leave, and only then
        // truncates: max-w-0 stops the text from widening the table.
        meta: { className: "w-full max-w-0 min-w-40" },
        cell: ({ row }) => (
          <span
            className="block truncate text-sm text-muted-foreground"
            title={row.original.notes ?? undefined}
          >
            {row.original.notes ?? "—"}
          </span>
        ),
      },
      {
        id: "donationCount",
        accessorKey: "donationCount",
        header: () => (
          <SortableHeader col="donationCount">Donations</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.donationCount ?? 0}
          </span>
        ),
      },
      {
        id: "totalAmount",
        accessorKey: "totalAmount",
        header: () => <SortableHeader col="totalAmount">Total</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatAmount(row.original.totalAmount)}
          </span>
        ),
      },
      {
        id: "cardFees",
        header: "Card fees",
        cell: ({ row }) => {
          const { cardFeeCents, cardFeeDeductionCents } = row.original;
          if (!cardFeeCents) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <span
              className="text-sm whitespace-nowrap text-muted-foreground tabular-nums"
              title={
                cardFeeDeductionCents
                  ? `${formatAmount(cardFeeDeductionCents)} taken off the tip organization's share`
                  : "Not deducted from anyone's share"
              }
            >
              {formatAmount(cardFeeCents)}
              {cardFeeDeductionCents ? (
                <span className="ml-1 text-xs">deducted</span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "paidOut",
        header: "Paid out",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {row.original.paymentCount
              ? formatAmount(row.original.paidOutCents)
              : "—"}
          </span>
        ),
      },
      {
        id: "adjustment",
        header: "Adjustment",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
            {row.original.adjustmentCents == null
              ? "—"
              : formatSigned(row.original.adjustmentCents)}
          </span>
        ),
      },
      {
        id: "residual",
        header: "Residual",
        cell: ({ row }) => {
          const { residualCents, balanced } = row.original;
          // nothing paid out or adjusted yet, so there's nothing to compare
          if (balanced == null || residualCents == null) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <span
              className={`text-sm whitespace-nowrap tabular-nums ${balanced ? "text-muted-foreground" : "text-amber-600"}`}
            >
              {formatSigned(residualCents)}
            </span>
          );
        },
      },
      {
        id: "ok",
        header: () => <span className="block text-center">OK</span>,
        cell: ({ row }) => (
          <span className="block text-center">
            {row.original.balanced == null ? (
              <span className="text-muted-foreground">·</span>
            ) : row.original.balanced ? (
              <span className="text-emerald-600">✓</span>
            ) : (
              <span className="text-amber-600">✗</span>
            )}
          </span>
        ),
      },
    ],
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortDir],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: pagination.pageCount,
    state: { sorting, columnVisibility },
    onColumnVisibilityChange,
  });

  const columnLabels: Record<string, string> = {
    id: "ID",
    datetime: "Date",
    notes: "Notes",
    donationCount: "Donations",
    totalAmount: "Total",
    cardFees: "Card fees",
    paidOut: "Paid out",
    adjustment: "Adjustment",
    residual: "Residual",
    ok: "OK",
  };

  const FILTER_DEFS: FilterDef[] = [
    {
      type: "date-range",
      label: "Date",
      fromKey: "dateFrom",
      toKey: "dateTo",
    },
  ];

  const FILTER_KEYS = ["dateFrom", "dateTo"];
  const filterParams: Record<string, string> = {};
  for (const k of FILTER_KEYS) {
    const value = searchParams.get(k);
    if (value !== null) filterParams[k] = value;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {pagination.total.toLocaleString()} transfers
          </p>
          <FilterBuilder
            filters={FILTER_DEFS}
            params={filterParams}
            onChange={pushUrl}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportCsvButton
            table="transfers"
            sortBy={sortBy}
            sortDir={sortDir}
          />
          <ColumnPicker
            table={table}
            labels={columnLabels}
            isDefault={isDefault}
            onReset={resetColumnVisibility}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-background">
        <Table stickyHeader>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.columnDef.meta?.className}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  No transfers found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <LinkedTableRow
                  key={row.id}
                  href={transferHref(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </LinkedTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
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
            Page {pagination.page} of {pagination.pageCount}
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
