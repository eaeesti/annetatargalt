"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "../../../../components/ui/badge";
import { SortIcon } from "../../../../components/sort-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * One row, fully resolved on the server. In particular `logoUrl` is already
 * absolute: the raw Strapi media path is relative and the base lives in a
 * server-only env var, so it cannot be rebuilt in the browser.
 *
 * The three stat fields are optional rather than nullable. An organization
 * that has never received a donation has no stats row at all, and `undefined`
 * is what lets `sortUndefined: "last"` keep those organizations at the bottom
 * whichever way the column is pointing.
 */
export type OrganizationRow = {
  id: number;
  internalId: string;
  title: string | null;
  active: boolean;
  fund: boolean;
  logoUrl: string | null;
  logoAlt: string | null;
  totalDonated?: number;
  donationCount?: number;
  lastDonationDate?: string;
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

// Tailwind background + text color pairs for the initial avatar
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function orgHref(internalId: string): string {
  return `/organizations/${encodeURIComponent(internalId)}`;
}

// ── Sortable header ───────────────────────────────────────────────────────────

/**
 * A clickable column header. First click on a column sorts it descending —
 * the useful direction for money and counts, which is what these columns
 * mostly are — and clicking the active column flips it.
 */
function SortableHeader({
  col,
  children,
  align = "left",
  sortBy,
  sortDir,
  onSort,
}: {
  col: string;
  children: React.ReactNode;
  align?: "left" | "right";
  sortBy: string;
  sortDir: string;
  onSort: (col: string) => void;
}) {
  return (
    <button
      className={`flex w-full items-center font-medium hover:text-foreground ${
        align === "right" ? "justify-end" : ""
      }`}
      onClick={() => onSort(col)}
    >
      {children}
      <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Sorting is done in the browser here, which is the one way this table departs
 * from donors/donations/transfers/transactions. Those page the server and so
 * must sort there; the organization list is fetched whole (a few dozen rows,
 * cached for minutes) and joined to its stats in memory, so there is nothing
 * to page and a server round trip per header click would only add latency.
 * The header controls behave and look the same either way.
 */
export function OrganizationsTable({ data }: { data: OrganizationRow[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "totalDonated", desc: true },
  ]);

  const sortBy = sorting[0]?.id ?? "";
  const sortDir: "asc" | "desc" = sorting[0]?.desc ? "desc" : "asc";

  // Bundled so each header below stays readable at its call site.
  const sortProps = {
    sortBy,
    sortDir,
    onSort: (col: string) =>
      setSorting([
        { id: col, desc: sortBy === col ? sortDir === "asc" : true },
      ]),
  };

  const columns = useMemo<ColumnDef<OrganizationRow>[]>(() => {
    return [
      {
        id: "logo",
        header: () => null,
        enableSorting: false,
        meta: { className: "w-12" },
        cell: ({ row }) =>
          row.original.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.original.logoUrl}
              alt={row.original.logoAlt ?? row.original.title ?? ""}
              className="h-7 w-7 rounded object-contain"
            />
          ) : (
            <div
              className={`h-7 w-7 rounded flex items-center justify-center text-xs font-semibold ${avatarColor(
                row.original.internalId,
              )}`}
            >
              {(row.original.title ?? row.original.internalId)
                .charAt(0)
                .toUpperCase()}
            </div>
          ),
      },
      {
        id: "title",
        accessorFn: (r) => r.title ?? r.internalId,
        sortingFn: "alphanumeric",
        header: () => (
          <SortableHeader col="title" {...sortProps}>
            Name
          </SortableHeader>
        ),
        cell: ({ row }) => (
          // Kept as a real link, unlike the other tables, so the org page can
          // still be opened in a new tab. The row handler below ignores clicks
          // that land on an anchor so the two never both navigate.
          <Link
            href={orgHref(row.original.internalId)}
            className="font-medium hover:underline"
          >
            {row.original.title ?? "—"}
          </Link>
        ),
      },
      {
        id: "fund",
        accessorKey: "fund",
        header: () => (
          <SortableHeader col="fund" {...sortProps}>
            Type
          </SortableHeader>
        ),
        cell: ({ row }) =>
          row.original.fund ? (
            <Badge variant="secondary">Fund</Badge>
          ) : (
            <Badge variant="outline">Organization</Badge>
          ),
      },
      {
        id: "active",
        accessorKey: "active",
        header: () => (
          <SortableHeader col="active" {...sortProps}>
            Status
          </SortableHeader>
        ),
        cell: ({ row }) =>
          row.original.active ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
      },
      {
        id: "totalDonated",
        accessorKey: "totalDonated",
        sortUndefined: "last",
        meta: { className: "text-right" },
        header: () => (
          <SortableHeader col="totalDonated" align="right" {...sortProps}>
            Total donated
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {row.original.totalDonated === undefined
              ? "—"
              : formatAmount(row.original.totalDonated)}
          </span>
        ),
      },
      {
        id: "donationCount",
        accessorKey: "donationCount",
        sortUndefined: "last",
        meta: { className: "text-right" },
        header: () => (
          <SortableHeader col="donationCount" align="right" {...sortProps}>
            Donations
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.donationCount ?? "—"}
          </span>
        ),
      },
      {
        id: "lastDonationDate",
        // Sorted on the timestamp, not the formatted et-EE string, which
        // would order by day-of-month.
        accessorFn: (r) =>
          r.lastDonationDate
            ? new Date(r.lastDonationDate).getTime()
            : undefined,
        sortUndefined: "last",
        header: () => (
          <SortableHeader col="lastDonationDate" {...sortProps}>
            Last donation
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {row.original.lastDonationDate
              ? formatDate(row.original.lastDonationDate)
              : "—"}
          </span>
        ),
      },
    ];
    // sortProps is rebuilt every render but derives only from these two, so
    // they are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {data.length.toLocaleString()} organizations
        </p>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      (header.column.columnDef.meta as { className?: string })
                        ?.className
                    }
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
                  className="text-center text-muted-foreground py-8"
                >
                  No organizations found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    // Let the name link handle its own click, including
                    // cmd/middle-click, instead of navigating twice.
                    if ((e.target as HTMLElement).closest("a")) return;
                    router.push(orgHref(row.original.internalId));
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        (cell.column.columnDef.meta as { className?: string })
                          ?.className
                      }
                    >
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
    </div>
  );
}
