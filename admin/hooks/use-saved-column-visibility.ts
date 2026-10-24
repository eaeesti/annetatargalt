"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { OnChangeFn, VisibilityState } from "@tanstack/react-table";

/*
 * Which columns a table shows, remembered in this browser: whatever someone
 * picks becomes their default for that table, until they reset it.
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
 * Column visibility for the table called `table`, starting from `defaults`
 * (columns left out are shown). Keep `defaults` a constant outside the
 * component, so it stays the same object between renders.
 */
export function useSavedColumnVisibility(
  table: string,
  defaults: VisibilityState,
) {
  const key = `columns:${table}`;
  // The server can't see localStorage, so it renders the defaults and the
  // browser swaps in the saved choice.
  const saved = useSyncExternalStore(
    subscribe,
    () => stored(key),
    () => null,
  );
  const columnVisibility = useMemo(
    () => ({ ...defaults, ...parse(saved) }),
    [defaults, saved],
  );

  const onColumnVisibilityChange: OnChangeFn<VisibilityState> = (updater) => {
    const next =
      typeof updater === "function" ? updater(columnVisibility) : updater;
    store(key, JSON.stringify(next));
  };

  const columns = new Set([
    ...Object.keys(defaults),
    ...Object.keys(columnVisibility),
  ]);
  const isDefault = [...columns].every(
    (id) => (columnVisibility[id] ?? true) === (defaults[id] ?? true),
  );

  return {
    columnVisibility,
    onColumnVisibilityChange,
    resetColumnVisibility: () => store(key, null),
    isDefault,
  };
}
