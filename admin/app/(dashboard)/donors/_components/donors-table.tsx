"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { SortIcon } from "../../../../components/sort-icon";
import { Badge } from "../../../../components/ui/badge";
import { ExportCsvButton } from "../../../../components/export-csv-button";
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
import { donorHref } from "../../../../lib/entity-links";
import { useRememberListUrl } from "../../../../components/remembered-link";
import { ariaSort } from "../../../../lib/aria-sort";
import {
  ColumnPicker,
  tableColumns,
} from "../../../../components/column-picker";
import { useSavedColumnVisibility } from "../../../../hooks/use-saved-column-visibility";

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

function donorName(row: DonorRow): string {
  if (row.firstName && row.lastName) return `${row.firstName} ${row.lastName}`;
  if (row.firstName) return row.firstName;
  if (row.lastName) return row.lastName;
  return row.email ?? `#${row.id}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DonorsTableProps {
  data: DonorRow[];
  pagination: Pagination;
  sortBy: string;
  sortDir: "asc" | "desc";
}

const PAGE_SIZES = [25, 50, 100, 250] as const;

// Every column starts shown on a wider screen.
const NO_HIDDEN_COLUMNS: VisibilityState = {};

const COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  lastName: "Name",
  email: "Email",
  recurringDonor: "Recurring",
  totalDonated: "Total donated",
  donationCount: "Donations",
  lastDonationDate: "Last donation",
};

// A phone shows who, how much in all, and when they last gave.
const PHONE_HIDDEN: VisibilityState = {
  id: false,
  email: false,
  recurringDonor: false,
  donationCount: false,
};

export function DonorsTable({
  data,
  pagination,
  sortBy,
  sortDir,
}: DonorsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    columnVisibility,
    onColumnVisibilityChange,
    setColumnVisible,
    resetColumnVisibility,
    isDefault,
  } = useSavedColumnVisibility("donors", NO_HIDDEN_COLUMNS, PHONE_HIDDEN);
  useRememberListUrl("/donors");

  function pushUrl(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(window.location.search);
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
          <EntityLink
            href={donorHref(row.original.id)}
            className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            #{row.original.id}
          </EntityLink>
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
            <span className="text-sm text-muted-foreground">No</span>
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
          <span className="text-sm tabular-nums">
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
    state: { sorting, columnVisibility },
    onColumnVisibilityChange,
  });

  const FILTER_DEFS: FilterDef[] = [
    {
      type: "text",
      key: "search",
      label: "Search",
      placeholder: "Name or email…",
    },
    {
      type: "select",
      key: "recurringStatus",
      label: "Recurring status",
      options: [
        { value: "new", label: "New (last month)" },
        { value: "retained", label: "Retained (last month)" },
        { value: "churned", label: "Churned (last month)" },
        { value: "churnedAllTime", label: "Churned (all time)" },
      ],
    },
  ];

  const FILTER_KEYS = ["search", "recurringStatus"];
  const filterParams: Record<string, string> = {};
  for (const k of FILTER_KEYS) {
    const value = searchParams.get(k);
    if (value !== null) filterParams[k] = value;
  }

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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ExportCsvButton table="donors" sortBy={sortBy} sortDir={sortDir} />
          <ColumnPicker
            columns={tableColumns(table, COLUMN_LABELS)}
            onToggle={setColumnVisible}
            isDefault={isDefault}
            onReset={resetColumnVisibility}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border bg-background">
        <Table stickyHeader>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort(header.column.id, sortBy, sortDir)}
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
                  No donors found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <LinkedTableRow key={row.id} href={donorHref(row.original.id)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
