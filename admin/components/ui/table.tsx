"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * `stickyHeader` keeps the column headers visible while the rows scroll.
 *
 * It cannot be done with the sticky positioning alone. This container already
 * sets overflow-x, and per the CSS overflow spec an axis specified `visible`
 * computes to `auto` when the other axis is not visible — so the container is
 * always a two-axis scrollport, and a sticky header inside it anchors here
 * rather than to the page. With no height cap the container simply grows with
 * its content, never scrolls vertically, and the header has nowhere to stick.
 * Capping the height is what makes it real.
 *
 * Sticky is applied to the `th` elements rather than to `thead`, which older
 * engines ignore, and the header's underline is drawn as an inset shadow
 * because a collapsed table's borders belong to the table rather than the
 * cell and would be left behind as it scrolls.
 */
function Table({
  className,
  stickyHeader,
  ...props
}: React.ComponentProps<"table"> & { stickyHeader?: boolean }) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto",
        stickyHeader && [
          // 15rem is what the page padding, <h1>, toolbar and pagination
          // occupy around the table. Written out in full because Tailwind
          // extracts class names by scanning source text — an interpolated
          // value would compile to no CSS at all.
          "max-h-[calc(100svh-15rem)] overflow-y-auto",
          "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10",
          "[&_thead_th]:bg-background",
          "[&_thead_th]:shadow-[inset_0_-1px_0_var(--border)]",
        ],
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
