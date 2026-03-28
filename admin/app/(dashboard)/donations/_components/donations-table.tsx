"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Columns3 } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  FilterBuilder,
  type FilterDef,
} from "../../../../components/filter-builder";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

// ── Types ────────────────────────────────────────────────────────────────────

export type DonationRow = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  paymentMethod: string | null;
  companyName: string | null;
  companyCode: string | null;
  donor: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  organizationDonations: {
    organizationInternalId: string;
    amount: number;
  }[];
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

function donorLabel(row: DonationRow): string | null {
  if (row.companyName) return row.companyName;
  if (row.donor?.firstName && row.donor?.lastName)
    return `${row.donor.firstName} ${row.donor.lastName}`;
  return row.donor?.email ?? null;
}

// ── Sort header ───────────────────────────────────────────────────────────────

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

interface DonationsTableProps {
  data: DonationRow[];
  pagination: Pagination;
  orgNames: Record<string, string>;
  sortBy: string;
  sortDir: "asc" | "desc";
}

const PAGE_SIZES = [25, 50, 100, 250] as const;

export function DonationsTable({
  data,
  pagination,
  orgNames,
  sortBy,
  sortDir,
}: DonationsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    id: false,
    finalized: false,
    paymentMethod: false,
    companyName: false,
    companyCode: false,
  });

  function pushUrl(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) sp.delete(key);
      else sp.set(key, value);
    }
    router.push(`/donations?${sp.toString()}`);
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      pushUrl({ sortDir: sortDir === "asc" ? "desc" : "asc", page: "1" });
    } else {
      pushUrl({ sortBy: col, sortDir: "desc", page: "1" });
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

  const columns = useMemo<ColumnDef<DonationRow>[]>(
    () => [
      {
        id: "id",
        accessorKey: "id",
        enableSorting: true,
        header: () => <SortableHeader col="id">ID</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            #{row.original.id}
          </span>
        ),
      },
      {
        id: "datetime",
        accessorKey: "datetime",
        enableSorting: true,
        header: () => <SortableHeader col="datetime">Date</SortableHeader>,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {formatDate(row.original.datetime)}
          </span>
        ),
      },
      {
        id: "amount",
        accessorKey: "amount",
        enableSorting: true,
        header: () => <SortableHeader col="amount">Amount</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-medium">
            {formatAmount(row.original.amount)}
          </span>
        ),
      },
      {
        id: "donor",
        enableSorting: false,
        header: "Donor",
        cell: ({ row }) => {
          const label = donorLabel(row.original);
          return label ? (
            <span className="text-sm">{label}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "organizations",
        enableSorting: false,
        header: "Organizations",
        cell: ({ row }) => {
          const ods = row.original.organizationDonations;
          if (ods.length === 0)
            return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-sm">
              {ods
                .map(
                  (od) =>
                    `${orgNames[od.organizationInternalId] ?? od.organizationInternalId} (${formatAmount(od.amount)})`,
                )
                .join(", ")}
            </span>
          );
        },
      },
      {
        id: "finalized",
        accessorKey: "finalized",
        enableSorting: true,
        header: () => <SortableHeader col="finalized">Status</SortableHeader>,
        cell: ({ row }) =>
          row.original.finalized ? (
            <Badge variant="default">Finalized</Badge>
          ) : (
            <Badge variant="secondary">Pending</Badge>
          ),
      },
      {
        id: "paymentMethod",
        accessorKey: "paymentMethod",
        enableSorting: true,
        header: () => (
          <SortableHeader col="paymentMethod">Payment</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.paymentMethod ?? "—"}
          </span>
        ),
      },
      {
        id: "companyName",
        accessorKey: "companyName",
        enableSorting: true,
        header: () => (
          <SortableHeader col="companyName">Company</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.companyName ?? "—"}</span>
        ),
      },
      {
        id: "companyCode",
        accessorKey: "companyCode",
        enableSorting: false,
        header: "Company Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.companyCode ?? "—"}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgNames, sortBy, sortDir],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: pagination.pageCount,
    state: { sorting, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const columnLabels: Record<string, string> = {
    id: "ID",
    datetime: "Date",
    amount: "Amount",
    donor: "Donor",
    organizations: "Organizations",
    finalized: "Status",
    paymentMethod: "Payment method",
    companyName: "Company",
    companyCode: "Company code",
  };

  const FILTER_DEFS: FilterDef[] = [
    {
      type: "date-range",
      label: "Date",
      fromKey: "dateFrom",
      toKey: "dateTo",
    },
    {
      type: "boolean",
      key: "finalized",
      label: "Status",
      trueLabel: "Finalized",
      falseLabel: "Pending",
    },
    {
      type: "boolean",
      key: "hasCompany",
      label: "Company",
      trueLabel: "Has company",
      falseLabel: "No company",
    },
    {
      type: "boolean",
      key: "hasTransfer",
      label: "Transfer",
      trueLabel: "Has transfer",
      falseLabel: "No transfer",
    },
  ];

  const FILTER_KEYS = [
    "dateFrom",
    "dateTo",
    "finalized",
    "hasCompany",
    "hasTransfer",
  ];
  const filterParams = Object.fromEntries(
    FILTER_KEYS.filter((k) => searchParams.has(k)).map((k) => [
      k,
      searchParams.get(k)!,
    ]),
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {pagination.total.toLocaleString()} donations
          </p>
          <FilterBuilder
            filters={FILTER_DEFS}
            params={filterParams}
            onChange={pushUrl}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm">
                <Columns3 className="h-4 w-4 mr-1.5" />
                Columns
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllColumns().map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(val) => col.toggleVisibility(!!val)}
                >
                  {columnLabels[col.id] ?? col.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
                  No donations found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/donations/${row.original.id}`)}
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
