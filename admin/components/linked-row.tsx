"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "./ui/table";
import { cn } from "@/lib/utils";

/*
 * A table row that opens a page when clicked anywhere, and behaves like a
 * link while doing it: Cmd/Ctrl-click and middle-click open a new tab. Each
 * row still needs a real link, like its ID: that's what keyboard users and
 * screen readers follow.
 */

// The row's own controls do what they do; a click on them isn't a row click.
const CONTROLS = "a, button, input, select, textarea, label, [role=button]";

function isRowClick(event: React.MouseEvent<HTMLElement>) {
  const { target } = event;
  return (
    target instanceof Element &&
    // React passes on clicks from portals, like a menu opened from the row,
    // which aren't inside the row at all.
    event.currentTarget.contains(target) &&
    !target.closest(CONTROLS) &&
    // Selecting text in a row shouldn't open it.
    !window.getSelection()?.toString()
  );
}

export function LinkedTableRow({
  href,
  className,
  ...props
}: React.ComponentProps<typeof TableRow> & { href: string }) {
  const router = useRouter();
  return (
    <TableRow
      {...props}
      onClick={(event) => {
        if (!isRowClick(event)) return;
        if (event.metaKey || event.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
      // A middle click opens a new tab, as it would on a link.
      onAuxClick={(event) => {
        if (event.button === 1 && isRowClick(event))
          window.open(href, "_blank");
      }}
      className={cn("cursor-pointer", className)}
    />
  );
}
