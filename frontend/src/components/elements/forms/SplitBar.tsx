"use client";

import { useRef } from "react";
import { classes } from "@/utils/react";
import { moveBorder } from "@/utils/split";
import { format } from "@/utils/string";
import { uiText } from "@/utils/ui-text";
import type { Locale } from "@/utils/locale";
import { splitColor } from "./split-colors";

export interface SplitPart {
  label: string;
  share: number;
}

interface SplitBarProps {
  /** The chosen ones, in order, each with its share; two or more. */
  parts: SplitPart[];
  /** Colours by position in the full list, so a part keeps its colour. */
  colorIndexes: number[];
  onChange: (shares: number[]) => void;
  locale: Locale;
}

/**
 * The whole split as one bar: a part per choice, and a handle between each
 * two that moves money only between them. The total stays 100%, and every
 * part keeps at least 1%. Handles are sliders for the keyboard too: arrows
 * move by 1%, with Shift by 5%.
 */
export default function SplitBar({
  parts,
  colorIndexes,
  onChange,
  locale,
}: SplitBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const shares = parts.map(({ share }) => share);
  // Where each handle sits: the running total up to it.
  const borders = shares
    .slice(0, -1)
    .map((_, index) =>
      shares.slice(0, index + 1).reduce((sum, share) => sum + share, 0),
    );

  function moveTo(index: number, clientX: number) {
    const bar = barRef.current;
    if (!bar) return;
    const { left, width } = bar.getBoundingClientRect();
    if (!width) return;
    onChange(moveBorder(shares, index, ((clientX - left) / width) * 100));
  }

  return (
    <div ref={barRef} className="relative my-2 h-12 touch-none select-none">
      <div className="flex h-full overflow-hidden rounded-lg">
        {parts.map((part, index) => (
          <div
            key={part.label}
            className={classes(
              splitColor(colorIndexes[index] ?? index).background,
              "flex flex-none items-center justify-center overflow-hidden text-sm font-bold whitespace-nowrap text-white",
            )}
            style={{ flexBasis: `${part.share}%` }}
          >
            {part.share >= 12 ? `${part.share}%` : ""}
          </div>
        ))}
      </div>
      {borders.map((border, index) => {
        const left = parts[index];
        const right = parts[index + 1];
        return (
          <div
            key={`${left.label}/${right.label}`}
            role="slider"
            tabIndex={0}
            aria-label={format(uiText(locale).splitBorder, {
              left: left.label,
              right: right.label,
            })}
            aria-valuemin={1}
            aria-valuemax={left.share + right.share - 1}
            aria-valuenow={left.share}
            aria-valuetext={`${left.label} ${left.share}%, ${right.label} ${right.share}%`}
            className="absolute -top-2 -bottom-2 -ml-4 flex w-8 cursor-ew-resize touch-none justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            style={{ left: `${border}%` }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              moveTo(index, event.clientX);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                moveTo(index, event.clientX);
              }
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 5 : 1;
              const moves: Record<string, number> = {
                ArrowLeft: border - step,
                ArrowDown: border - step,
                ArrowRight: border + step,
                ArrowUp: border + step,
                Home: 0,
                End: 100,
              };
              const position = moves[event.key];
              if (typeof position !== "number") return;
              event.preventDefault();
              onChange(moveBorder(shares, index, position));
            }}
          >
            <span className="block h-full w-3.5 rounded-lg border-2 border-slate-900 bg-white shadow-md" />
          </div>
        );
      })}
    </div>
  );
}
