"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { formatEuros } from "../../../../lib/money";

export type Candidate = {
  id: number;
  datetime: string;
  amountCents: number;
  reconciled: boolean;
  donorName: string | null;
  orgSplit: { internalId: string; amountCents: number }[];
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Date-range → `/api/transfers/preview` → checkbox list of finalized,
 * not-yet-transferred donations. Shared by the new-round builder and the
 * transfer-detail "add donations" panel.
 *
 * This owns the range inputs, the fetch and the selection; the parent owns the
 * action button (Create / Add) and any summary, rendered via `children(chosen)`
 * once candidates are loaded.
 */
export function CandidatePicker({
  defaultFrom,
  defaultTo,
  preselectAll = false,
  loadLabel = "Load donations",
  onLoad,
  onChange,
  children,
}: {
  defaultFrom?: string;
  defaultTo?: string;
  /** check every candidate on load (round builder) vs none (add-to-existing) */
  preselectAll?: boolean;
  loadLabel?: string;
  onLoad?: (range: { from: string; to: string }) => void;
  /** fired whenever the selection changes — for a summary rendered outside */
  onChange?: (chosen: Candidate[]) => void;
  children?: (chosen: Candidate[]) => ReactNode;
}) {
  const [dateFrom, setDateFrom] = useState(defaultFrom ?? "");
  const [dateTo, setDateTo] = useState(defaultTo ?? "");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const chosen = useMemo(
    () => (candidates ?? []).filter((c) => selected.has(c.id)),
    [candidates, selected],
  );

  useEffect(() => {
    onChange?.(chosen);
    // only the selection drives this; onChange identity is the parent's concern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  async function load() {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/transfers/preview?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      const rows = json.data as Candidate[];
      setCandidates(rows);
      setSelected(preselectAll ? new Set(rows.map((r) => r.id)) : new Set());
      onLoad?.({ from: dateFrom, to: dateTo });
    } catch {
      setLoadError("Failed to load donations for that range.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-40"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-40"
          />
        </label>
        <Button
          size="sm"
          onClick={load}
          disabled={loading || !dateFrom || !dateTo}
        >
          {loading ? "Loading…" : loadLabel}
        </Button>
      </div>

      {loadError && <p className="text-xs text-destructive">{loadError}</p>}

      {candidates &&
        (candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No finalized, not-yet-transferred donations in that range.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {chosen.length} of {candidates.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  className="hover:text-foreground"
                  onClick={() =>
                    setSelected(new Set(candidates.map((c) => c.id)))
                  }
                >
                  Select all
                </button>
                <button
                  className="hover:text-foreground"
                  onClick={() => setSelected(new Set())}
                >
                  Select none
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1 pr-2" />
                    <th className="py-1 pr-3">Date</th>
                    <th className="py-1 pr-3">Donor</th>
                    <th className="py-1 pr-3 text-right">Amount</th>
                    <th className="py-1">Bank line</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.id} className="border-t border-border/50">
                      <td className="py-1 pr-2">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(c.id);
                              else next.delete(c.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="py-1 pr-3 whitespace-nowrap">
                        {fmtDate(c.datetime)}
                      </td>
                      <td className="py-1 pr-3">{c.donorName ?? "—"}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">
                        {formatEuros(c.amountCents)}
                      </td>
                      <td className="py-1">
                        {c.reconciled ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <span
                            className="text-amber-600"
                            title="not reconciled"
                          >
                            ✗
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {children?.(chosen)}
          </>
        ))}
    </div>
  );
}
