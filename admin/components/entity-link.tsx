"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

// href builders live in lib/entity-links (a plain module) so server components
// can call them during render — this file is a client boundary.

/**
 * A hyperlink to another admin entity (donation, donor, transfer, …).
 *
 * Use `newTab` when following the link would interrupt work in progress on the
 * current screen — an open CSV-import preview, an unsaved inline editor, an
 * expanded reconciliation drawer. Everywhere else links open in the same tab.
 *
 * Use `stopRowClick` when the link sits inside a table row that is itself
 * clickable, so the nested link wins the click instead of the row handler.
 */
export function EntityLink({
  href,
  children,
  newTab = false,
  stopRowClick = false,
  className = "text-primary hover:underline",
}: {
  href: string;
  children: ReactNode;
  newTab?: boolean;
  stopRowClick?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      {...(newTab && { target: "_blank", rel: "noopener noreferrer" })}
      {...(stopRowClick && {
        onClick: (e: MouseEvent) => e.stopPropagation(),
      })}
    >
      {children}
    </Link>
  );
}
