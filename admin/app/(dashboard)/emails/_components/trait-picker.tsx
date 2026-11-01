"use client";

import {
  isWholeYear,
  type EmailOptions,
  type Period,
  type Traits,
} from "./types";

/**
 * A choice of yes, no or either for each thing a donor is or isn't, such as
 * recurring: who a block is for, or who the preview shows the email as.
 * Those about what was given in a period wait for the email to have one,
 * and the one about the yearly tax limit for a whole year.
 */
export function TraitPicker({
  options,
  traits,
  period,
  onChange,
}: {
  options: EmailOptions["traits"];
  traits: Traits;
  period: Period | undefined;
  onChange: (traits: Traits) => void;
}) {
  function choose(trait: string, value: string) {
    const { [trait]: _, ...others } = traits;
    onChange(value === "" ? others : { ...others, [trait]: value === "yes" });
  }

  return options.map((option) => {
    const why =
      option.needsPeriod && !period
        ? "Needs a period: set “Gave between”"
        : option.needsYear && !isWholeYear(period)
          ? "Needs one whole year: “Last year” or “This year”"
          : null;
    const unavailable = Boolean(why);
    const value = traits[option.value];
    return (
      <select
        key={option.value}
        aria-label={option.label}
        title={why ?? undefined}
        disabled={unavailable && value === undefined}
        className={
          value === undefined
            ? "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs text-muted-foreground disabled:opacity-50"
            : "h-7 rounded-md border border-primary bg-primary/10 px-1.5 text-xs font-medium text-foreground"
        }
        value={value === undefined ? "" : value ? "yes" : "no"}
        onChange={(event) => choose(option.value, event.target.value)}
      >
        <option value="">{option.label}: either</option>
        <option value="yes">{option.label}: yes</option>
        <option value="no">{option.label}: no</option>
      </select>
    );
  });
}
