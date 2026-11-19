"use client";

import { useId, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { classes } from "@/utils/react";

interface SummaryBarProps {
  title: string | null;
  /** "Monthly" or "One time", whichever the donor chose. */
  typeText: string | null;
  total: string;
  /** The donation line by line, shown when the bar is opened. */
  children: React.ReactNode;
}

/**
 * The donation in one line on narrow screens, total always in view: a tap
 * opens the lines it's made of.
 */
export default function SummaryBar({
  title,
  typeText,
  total,
  children,
}: SummaryBarProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200 ring-inset">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-slate-900">
            {title}
          </span>
          {typeText && (
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-primary-700">
              {typeText}
            </span>
          )}
        </span>
        <span className="text-lg font-bold tracking-tight whitespace-nowrap text-primary-700">
          {total}
        </span>
        <ChevronDownIcon
          className={classes(
            open ? "rotate-180" : "",
            "h-5 w-5 flex-none text-slate-600 transition-transform",
          )}
          aria-hidden={true}
        />
      </button>
      <div id={panelId} hidden={!open} className="px-4 pb-1">
        {children}
      </div>
    </div>
  );
}
