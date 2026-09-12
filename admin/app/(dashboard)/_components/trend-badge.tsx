"use client";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../../../components/ui/tooltip";

/**
 * +N% / -N% badge for a period-over-period change. `pct` is display-only —
 * the tooltip shows the actual current vs prior values it was computed from,
 * since the raw prior-period number isn't shown anywhere else on the page.
 * Takes already-formatted labels (not a formatter function): this is a client
 * component rendered from a server component, and functions can't cross that
 * boundary as props.
 */
export function TrendBadge({
  pct,
  currentLabel,
  priorLabel,
}: {
  pct: number | null;
  currentLabel: string;
  priorLabel: string;
}) {
  if (pct === null) return null;
  const positive = pct >= 0;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${positive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
            >
              {positive ? "+" : ""}
              {pct}%
            </span>
          }
        />
        <TooltipContent>
          {priorLabel} → {currentLabel}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
