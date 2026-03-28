"use client";

import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { X, Plus, CalendarIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BooleanFilterDef = {
  type: "boolean";
  key: string;
  label: string;
  trueLabel: string;
  falseLabel: string;
};

export type DateRangeFilterDef = {
  type: "date-range";
  label: string;
  fromKey: string;
  toKey: string;
};

export type TextFilterDef = {
  type: "text";
  key: string;
  label: string;
  placeholder?: string;
};

export type FilterDef = BooleanFilterDef | DateRangeFilterDef | TextFilterDef;

export interface FilterBuilderProps {
  filters: FilterDef[];
  /** Current URL param values relevant to these filters */
  params: Record<string, string>;
  /** Called with partial URL param updates to apply (undefined = delete param) */
  onChange: (updates: Record<string, string | undefined>) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterId(f: FilterDef): string {
  return f.type === "date-range" ? `${f.fromKey}:${f.toKey}` : f.key;
}

function isActive(f: FilterDef, params: Record<string, string>): boolean {
  if (f.type === "date-range") return !!(params[f.fromKey] || params[f.toKey]);
  return f.key in params;
}

function activeLabel(f: FilterDef, params: Record<string, string>): string {
  if (f.type === "boolean") {
    const val = params[f.key] === "true" ? f.trueLabel : f.falseLabel;
    return `${f.label}: ${val}`;
  }
  if (f.type === "date-range") {
    const from = params[f.fromKey];
    const to = params[f.toKey];
    if (from && to) return `${f.label}: ${from} – ${to}`;
    if (from) return `${f.label}: from ${from}`;
    return `${f.label}: to ${to}`;
  }
  return `${f.label}: ${params[f.key]}`;
}

function clearUpdates(f: FilterDef): Record<string, undefined> {
  if (f.type === "date-range")
    return { [f.fromKey]: undefined, [f.toKey]: undefined };
  return { [f.key]: undefined };
}

function toIsoDate(d: Date): string {
  // YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T12:00:00`); // noon to avoid TZ shift
  return isNaN(d.getTime()) ? undefined : d;
}

// ── DateRangeForm ─────────────────────────────────────────────────────────────

function DateRangeForm({
  filter,
  initialFrom,
  initialTo,
  onApply,
  onCancel,
}: {
  filter: DateRangeFilterDef;
  initialFrom?: string;
  initialTo?: string;
  onApply: (updates: Record<string, string | undefined>) => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>({
    from: parseIsoDate(initialFrom),
    to: parseIsoDate(initialTo),
  });

  function rangeLabel() {
    if (range?.from && range?.to) {
      return `${toIsoDate(range.from)} – ${toIsoDate(range.to)}`;
    }
    if (range?.from) return `from ${toIsoDate(range.from)}`;
    if (range?.to) return `to ${toIsoDate(range.to)}`;
    return "Pick a date range";
  }

  function handleApply() {
    setOpen(false);
    onApply({
      [filter.fromKey]: range?.from ? toIsoDate(range.from) : undefined,
      [filter.toKey]: range?.to ? toIsoDate(range.to) : undefined,
    });
  }

  const rowCls =
    "flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 shadow-sm";

  return (
    <div className={rowCls}>
      <span className="text-sm text-muted-foreground mr-0.5">
        {filter.label}:
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2.5 text-xs gap-1.5"
            >
              <CalendarIcon className="h-3 w-3" />
              {rangeLabel()}
            </Button>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(r) => setRange(r)}
            numberOfMonths={2}
            autoFocus
          />
          <div className="flex justify-end gap-2 border-t px-3 py-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!range?.from} onClick={handleApply}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <button
        onClick={onCancel}
        className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── AddFilterForm ─────────────────────────────────────────────────────────────

function AddFilterForm({
  filter,
  initialValues,
  onApply,
  onCancel,
}: {
  filter: FilterDef;
  initialValues?: Record<string, string>;
  onApply: (updates: Record<string, string | undefined>) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(
    filter.type === "text" ? (initialValues?.[filter.key] ?? "") : "",
  );

  const rowCls =
    "flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 shadow-sm";

  if (filter.type === "boolean") {
    return (
      <div className={rowCls}>
        <span className="text-sm text-muted-foreground mr-0.5">
          {filter.label}:
        </span>
        <Button
          size="sm"
          className="h-6 px-2.5 text-xs"
          onClick={() => onApply({ [filter.key]: "true" })}
        >
          {filter.trueLabel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2.5 text-xs"
          onClick={() => onApply({ [filter.key]: "false" })}
        >
          {filter.falseLabel}
        </Button>
        <button
          onClick={onCancel}
          className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (filter.type === "date-range") {
    return (
      <DateRangeForm
        filter={filter}
        initialFrom={initialValues?.[filter.fromKey]}
        initialTo={initialValues?.[filter.toKey]}
        onApply={onApply}
        onCancel={onCancel}
      />
    );
  }

  // text
  return (
    <form
      className={rowCls}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onApply({ [filter.key]: text.trim() });
      }}
    >
      <span className="text-sm text-muted-foreground mr-0.5">
        {filter.label}:
      </span>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={filter.placeholder ?? "Type to filter…"}
        className="h-6 w-44 px-2 text-xs"
        autoFocus
      />
      <Button size="sm" type="submit" className="h-6 px-2.5 text-xs">
        Apply
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

// ── FilterBuilder ─────────────────────────────────────────────────────────────

export function FilterBuilder({
  filters,
  params,
  onChange,
}: FilterBuilderProps) {
  const [adding, setAdding] = useState<FilterDef | null>(null);
  const [editing, setEditing] = useState<FilterDef | null>(null);

  const activeFilters = filters.filter((f) => isActive(f, params));
  const availableFilters = filters.filter((f) => !isActive(f, params));

  function handleApply(updates: Record<string, string | undefined>) {
    onChange({ ...updates, page: "1" });
    setAdding(null);
    setEditing(null);
  }

  function handleRemove(f: FilterDef) {
    onChange({ ...clearUpdates(f), page: "1" });
    if (editing && filterId(editing) === filterId(f)) setEditing(null);
  }

  function getInitialValues(f: FilterDef): Record<string, string> {
    if (f.type === "date-range") {
      const vals: Record<string, string> = {};
      if (params[f.fromKey]) vals[f.fromKey] = params[f.fromKey];
      if (params[f.toKey]) vals[f.toKey] = params[f.toKey];
      return vals;
    }
    if (f.type !== "boolean" && params[f.key])
      return { [f.key]: params[f.key] };
    return {};
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Active filter chips */}
      {activeFilters.map((f) => {
        const id = filterId(f);
        const isEditingThis = editing && filterId(editing) === id;

        if (isEditingThis) {
          return (
            <AddFilterForm
              key={id}
              filter={f}
              initialValues={getInitialValues(f)}
              onApply={handleApply}
              onCancel={() => setEditing(null)}
            />
          );
        }

        return (
          <Badge
            key={id}
            variant="secondary"
            className="gap-1 pl-2.5 pr-1 py-1 font-normal text-xs"
          >
            <button
              onClick={() => {
                setAdding(null);
                setEditing(f);
              }}
              className="hover:text-foreground transition-colors"
            >
              {activeLabel(f, params)}
            </button>
            <button
              onClick={() => handleRemove(f)}
              className="ml-0.5 rounded hover:bg-muted transition-colors"
              aria-label="Remove filter"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {/* Inline add form */}
      {adding && (
        <AddFilterForm
          filter={adding}
          onApply={handleApply}
          onCancel={() => setAdding(null)}
        />
      )}

      {/* Add filter dropdown */}
      {!adding && !editing && availableFilters.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Add filter
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuGroup>
              {availableFilters.map((f) => (
                <DropdownMenuItem
                  key={filterId(f)}
                  onClick={() => setAdding(f)}
                >
                  {f.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
