"use client";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../../../../components/ui/tooltip";

/** ✓ / · for whether a donation is matched to a bank transaction, with a tooltip. */
export function ReconciledMark({
  transactionId,
}: {
  transactionId: string | null;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-block w-3 text-center">
              {transactionId ? (
                <span className="text-emerald-600">✓</span>
              ) : (
                <span className="text-muted-foreground">·</span>
              )}
            </span>
          }
        />
        <TooltipContent>
          {transactionId
            ? `Matched to transaction ${transactionId}`
            : "Not matched to a transaction"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
