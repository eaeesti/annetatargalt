"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { SortIcon } from "../../../../components/sort-icon";
import {
  RecurringStatusBadge,
  type RecurringDonationStatus,
} from "../../../../components/recurring-status-badge";
import { ExportCsvButton } from "../../../../components/export-csv-button";
import { Button } from "../../../../components/ui/button";
import { EntityLink } from "../../../../components/entity-link";
import { donorHref } from "../../../../lib/entity-links";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { formatDate } from "../../../../lib/dates";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecurringDonationRow = {
  id: number;
  status: RecurringDonationStatus;
  amount: number;
  datetime: string;
  companyName: string | null;
  donorId: number;
  donorFirstName: string | null;
  donorLastName: string | null;
  donorEmail: string | null;
  donationCount: number | null;
  lastDonationDate: string | null;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function donorName(row: RecurringDonationRow): string {
  if (row.donorFirstName && row.donorLastName)
    return `${row.donorFirstName} ${row.donorLastName}`;
  if (row.donorFirstName) return row.donorFirstName;
  if (row.donorLastName) return row.donorLastName;
  return row.donorEmail ?? `Donor #${row.donorId}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RecurringDonationsTableProps {
  data: RecurringDonationRow[];
  pagination: Pagination;
  sortBy: string;
  sortDir: "asc" | "desc";
}

const PAGE_SIZES = [25, 50, 100, 250] as const;

export function RecurringDonationsTable({
  data,
  pagination,
  sortBy,
  sortDir,
}: RecurringDonationsTableProps) {
  const router = useRouter();

  function pushUrl(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) sp.delete(key);
      else sp.set(key, value);
    }
    router.push(`/recurring-donations?${sp.toString()}`);
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      pushUrl({ sortDir: sortDir === "asc" ? "desc" : "asc", page: "1" });
    } else {
      pushUrl({ sortBy: col, sortDir: "asc", page: "1" });
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

  const columns = useMemo<ColumnDef<RecurringDonationRow>[]>(
    () => [
      {
        id: "id",
        accessorKey: "id",
        header: () => <SortableHeader col="id">ID</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            #{row.original.id}
          </span>
        ),
      },
      {
        id: "donorLastName",
        header: () => (
          <SortableHeader col="donorLastName">Donor</SortableHeader>
        ),
        cell: ({ row }) => (
          <EntityLink
            href={donorHref(row.original.donorId)}
            stopRowClick
            className="text-sm hover:underline"
          >
            {donorName(row.original)}
          </EntityLink>
        ),
      },
      {
        id: "amount",
        accessorKey: "amount",
        header: () => <SortableHeader col="amount">Amount/mo</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatAmount(row.original.amount)}/mo
          </span>
        ),
      },
      {
        id: "datetime",
        accessorKey: "datetime",
        header: () => <SortableHeader col="datetime">Started</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.datetime)}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: () => <SortableHeader col="status">Status</SortableHeader>,
        cell: ({ row }) => (
          <RecurringStatusBadge status={row.original.status} />
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
        id: "lastDonationDate",
        accessorKey: "lastDonationDate",
        header: () => (
          <SortableHeader col="lastDonationDate">Last donation</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-muted-foreground">
            {row.original.lastDonationDate
              ? formatDate(row.original.lastDonationDate)
              : "—"}
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
    state: { sorting },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {pagination.total.toLocaleString()} recurring donations
        </p>
        <ExportCsvButton
          table="recurring-donations"
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border bg-background">
        <Table stickyHeader>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
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
                  No recurring donations found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/recurring-donations/${row.original.id}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
