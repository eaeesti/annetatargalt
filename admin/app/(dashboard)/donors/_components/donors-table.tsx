"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
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

// ── Types ─────────────────────────────────────────────────────────────────────

export type DonorRow = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  idCode: string | null;
  recurringDonor: boolean | null;
  createdAt: string;
  totalDonated: number;
  donationCount: number;
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function donorName(row: DonorRow): string {
  if (row.firstName && row.lastName) return `${row.firstName} ${row.lastName}`;
  if (row.firstName) return row.firstName;
  if (row.lastName) return row.lastName;
  return row.email ?? `#${row.id}`;
}

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({
  col,
  sortBy,
  sortDir,
}: {
  col: string;
  sortBy: string;
  sortDir: string;
}) {
  if (sortBy !== col)
    return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? (
    <ChevronUp className="ml-1 h-3 w-3" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3" />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DonorsTableProps {
  data: DonorRow[];
  pagination: Pagination;
  sortBy: string;
  sortDir: "asc" | "desc";
}

const PAGE_SIZES = [25, 50, 100, 250] as const;

export function DonorsTable({
  data,
  pagination,
  sortBy,
  sortDir,
}: DonorsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function pushUrl(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) sp.delete(key);
      else sp.set(key, value);
    }
    router.push(`/donors?${sp.toString()}`);
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

  const columns = useMemo<ColumnDef<DonorRow>[]>(
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
        id: "lastName",
        header: () => <SortableHeader col="lastName">Name</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm">{donorName(row.original)}</span>
        ),
      },
      {
        id: "email",
        accessorKey: "email",
        header: () => <SortableHeader col="email">Email</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.email ?? "—"}
          </span>
        ),
      },
      {
        id: "recurringDonor",
        accessorKey: "recurringDonor",
        header: () => (
          <SortableHeader col="recurringDonor">Recurring</SortableHeader>
        ),
        cell: ({ row }) =>
          row.original.recurringDonor ? (
            <Badge variant="default">Yes</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          ),
      },
      {
        id: "totalDonated",
        accessorKey: "totalDonated",
        header: () => (
          <SortableHeader col="totalDonated">Total donated</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatAmount(row.original.totalDonated)}
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
          <span className="tabular-nums text-sm">
            {row.original.donationCount}
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
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {row.original.lastDonationDate
              ? formatDate(row.original.lastDonationDate)
              : "—"}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const FILTER_DEFS: FilterDef[] = [
    {
      type: "text",
      key: "search",
      label: "Search",
      placeholder: "Name or email…",
    },
  ];

  const FILTER_KEYS = ["search"];
  const filterParams = Object.fromEntries(
    FILTER_KEYS.filter((k) => searchParams.has(k)).map((k) => [
      k,
      searchParams.get(k)!,
    ]),
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {pagination.total.toLocaleString()} donors
        </p>
        <FilterBuilder
          filters={FILTER_DEFS}
          params={filterParams}
          onChange={pushUrl}
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
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
                  className="text-center text-muted-foreground py-8"
                >
                  No donors found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/donors/${row.original.id}`)}
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
