"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { OnChangeFn, VisibilityState } from "@tanstack/react-table";
import { useIsMobile } from "./use-mobile";

/*
 * Which columns a table shows. A phone starts with fewer than a wider
 * screen; a column someone shows or hides stays that way in this browser,
 * whatever the width, until they reset it. Columns they never touched keep
 * following the screen's defaults.
 */

// The browser announces a change only to other tabs, so this tab's own
// changes are announced here.
const listeners = new Set<() => void>();

// The latest choice per table. Storage can be off, e.g. in a private window;
// the choice then lasts until the page is reloaded.
const latest = new Map<string, string | null>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function stored(key: string): string | null {
  const known = latest.get(key);
  if (known !== undefined) return known;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null) {
  latest.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Kept in `latest` instead.
  }
  for (const listener of listeners) listener();
}

function parse(saved: string | null): VisibilityState {
  if (!saved) return {};
  try {
    const value: unknown = JSON.parse(saved);
    if (typeof value !== "object" || value === null) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Column visibility for the table called `table`. `defaults` are for a wider
 * screen and `phoneDefaults` what a phone hides on top (columns left out of
 * both are shown). Keep both constants outside the component, so they stay
 * the same objects between renders.
 */
export function useSavedColumnVisibility(
  table: string,
  defaults: VisibilityState,
  phoneDefaults: VisibilityState = {},
) {
  const key = `columns:${table}`;
  const isPhone = useIsMobile();
  // The server can't see localStorage, so it renders the defaults and the
  // browser swaps in the saved choice.
  const saved = useSyncExternalStore(
    subscribe,
    () => stored(key),
    () => null,
  );
  const choices = useMemo(() => parse(saved), [saved]);
  const columnVisibility = useMemo(
    () => ({ ...defaults, ...(isPhone ? phoneDefaults : {}), ...choices }),
    [defaults, phoneDefaults, isPhone, choices],
  );

  const onColumnVisibilityChange: OnChangeFn<VisibilityState> = (updater) => {
    const next =
      typeof updater === "function" ? updater(columnVisibility) : updater;
    // only the columns that changed become choices
    const changed = Object.entries(next).filter(
      ([id, visible]) => (columnVisibility[id] ?? true) !== visible,
    );
    store(key, JSON.stringify({ ...choices, ...Object.fromEntries(changed) }));
  };

  return {
    columnVisibility,
    onColumnVisibilityChange,
    /** Shows or hides one column. */
    setColumnVisible: (id: string, visible: boolean) =>
      onColumnVisibilityChange((current) => ({ ...current, [id]: visible })),
    resetColumnVisibility: () => store(key, null),
    isDefault: Object.keys(choices).length === 0,
  };
}
