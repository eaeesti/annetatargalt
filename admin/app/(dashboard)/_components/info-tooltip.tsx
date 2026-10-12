"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../../../components/ui/tooltip";

/** Small (i) icon with a hover tooltip — for explaining how a stat is derived. */
export function InfoTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex text-muted-foreground hover:text-foreground">
              <Info className="h-3.5 w-3.5" />
            </span>
          }
        />
        <TooltipContent className="max-w-64 font-normal tracking-normal text-wrap normal-case">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
