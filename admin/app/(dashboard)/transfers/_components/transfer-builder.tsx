"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";

type Candidate = {
  id: number;
  datetime: string;
  amountCents: number;
  reconciled: boolean;
  donorName: string | null;
  orgSplit: { internalId: string; amountCents: number }[];
};

const eur = (c: number) => `€${(c / 100).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

export function TransferBuilder({ defaultFrom }: { defaultFrom?: string }) {
  const router = useRouter();

  const [dateFrom, setDateFrom] = useState(defaultFrom ?? "");
  const [dateTo, setDateTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [transferDate, setTransferDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadCandidates() {
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
      setSelected(new Set(rows.map((r) => r.id)));
      // the round is conventionally dated at the end of the period it covers
      setTransferDate(dateTo);
    } catch {
      setLoadError("Failed to load donations for that range.");
    } finally {
      setLoading(false);
    }
  }

  const chosen = useMemo(
    () => (candidates ?? []).filter((c) => selected.has(c.id)),
    [candidates, selected],
  );
  const total = chosen.reduce((s, c) => s + c.amountCents, 0);
  const unreconciled = chosen.filter((c) => !c.reconciled).length;

  const perOrg = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of chosen)
      for (const o of c.orgSplit)
        m.set(o.internalId, (m.get(o.internalId) ?? 0) + o.amountCents);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [chosen]);

  async function create() {
    if (!transferDate || chosen.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datetime: transferDate,
          notes: notes || null,
          donationIds: chosen.map((c) => c.id),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message ?? "Failed to create transfer");
        return;
      }
      const json = await res.json();
      router.push(`/transfers/${json.data.id}`);
    } catch {
      alert("Failed to create transfer — check your connection and try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Seed from a date range
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">From</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">To</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </label>
          <Button
            size="sm"
            onClick={loadCandidates}
            disabled={loading || !dateFrom || !dateTo}
          >
            {loading ? "Loading…" : "Load donations"}
          </Button>
        </div>
        {loadError && <p className="text-xs text-destructive">{loadError}</p>}
      </div>

      {/* Candidate list */}
      {candidates && (
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Donations ({chosen.length} of {candidates.length})
            </h2>
            <div className="flex gap-2 text-xs">
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setSelected(new Set(candidates.map((c) => c.id)))
                }
              >
                Select all
              </button>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </div>
          </div>

          {candidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No finalized, unassigned donations in that range.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card text-muted-foreground">
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
                        {c.datetime.slice(0, 10)}
                      </td>
                      <td className="py-1 pr-3">{c.donorName ?? "—"}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">
                        {eur(c.amountCents)}
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
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs">
            <span>
              Total{" "}
              <span className="font-semibold tabular-nums">{eur(total)}</span>
            </span>
            {unreconciled > 0 && (
              <span className="text-amber-600">
                {unreconciled} not reconciled to a bank line
              </span>
            )}
          </div>

          {perOrg.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Per-organization breakdown ({perOrg.length})
              </summary>
              <div className="mt-2 space-y-1">
                {perOrg.map(([id, amt]) => (
                  <div key={id} className="flex justify-between">
                    <span>{id}</span>
                    <span className="tabular-nums">{eur(amt)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Create */}
      {candidates && chosen.length > 0 && (
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Create the round
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">
                Transfer date
              </span>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-40"
              />
            </label>
            <label className="flex-1 text-xs">
              <span className="mb-1 block text-muted-foreground">
                Notes (optional)
              </span>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Q1 2026 distribution"
              />
            </label>
            <Button
              onClick={create}
              disabled={submitting || !transferDate || chosen.length === 0}
            >
              {submitting
                ? "Creating…"
                : `Create transfer (${chosen.length} donations)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
