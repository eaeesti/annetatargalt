"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Badge } from "../../../../components/ui/badge";
import { ReconciledMark } from "./reconciled-mark";

type Row = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  transactionId: string | null;
  orgLabel: string;
};

type Candidate = {
  id: number;
  datetime: string;
  amountCents: number;
  reconciled: boolean;
  donorName: string | null;
};

const eur = (c: number) => `€${(c / 100).toFixed(2)}`;

function fmtDate(iso: string, withTime = false): string {
  return new Date(iso).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** Shift an ISO date (YYYY-MM-DD...) by a number of days, returning YYYY-MM-DD. */
function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Editable donation list for a transfer round: remove a donation from the
 * round, or pull in finalized unassigned donations from a date window. Both
 * go through `PATCH /api/transfers/:id`.
 */
export function TransferDonationsEditor({
  transferId,
  transferDate,
  donations,
}: {
  transferId: number;
  transferDate: string;
  donations: Row[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | "add" | null>(null);

  const [adding, setAdding] = useState(false);
  const [dateFrom, setDateFrom] = useState(shiftDays(transferDate, -90));
  const [dateTo, setDateTo] = useState(transferDate.slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const chosen = useMemo(
    () => (candidates ?? []).filter((c) => selected.has(c.id)),
    [candidates, selected],
  );

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/transfers/${transferId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error?.message ?? "Failed to save");
      return false;
    }
    return true;
  }

  async function removeDonation(id: number) {
    if (!confirm(`Remove donation #${id} from transfer #${transferId}?`))
      return;
    setBusy(id);
    try {
      if (await patch({ removeDonationIds: [id] })) router.refresh();
    } catch {
      alert("Failed to save — check your connection and try again");
    } finally {
      setBusy(null);
    }
  }

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
      // nothing pre-checked — this is add-to-an-existing-round, usually to fix
      // one mis-assignment, not to sweep in a whole window
      setSelected(new Set());
    } catch {
      setLoadError("Failed to load donations for that range.");
    } finally {
      setLoading(false);
    }
  }

  async function addSelected() {
    if (chosen.length === 0) return;
    setBusy("add");
    try {
      if (await patch({ addDonationIds: chosen.map((c) => c.id) })) {
        setAdding(false);
        setCandidates(null);
        router.refresh();
      }
    } catch {
      alert("Failed to save — check your connection and try again");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {donations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No donations on this round.
        </p>
      ) : (
        <div className="space-y-1">
          {donations.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 -mx-2"
            >
              <Link
                href={`/donations/${d.id}`}
                className="flex min-w-0 items-center gap-3"
              >
                <ReconciledMark transactionId={d.transactionId} />
                <span className="w-14 font-mono text-xs text-muted-foreground">
                  #{d.id}
                </span>
                <span className="whitespace-nowrap text-muted-foreground">
                  {fmtDate(d.datetime, true)}
                </span>
                {!d.finalized && (
                  <Badge variant="destructive" className="text-xs">
                    Not finalized
                  </Badge>
                )}
              </Link>
              <div className="flex items-center gap-3">
                {d.orgLabel && (
                  <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:block">
                    {d.orgLabel}
                  </span>
                )}
                <span className="font-medium tabular-nums">
                  {eur(d.amount)}
                </span>
                <button
                  className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                  disabled={busy === d.id}
                  onClick={() => removeDonation(d.id)}
                >
                  {busy === d.id ? "…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setAdding(true)}
        >
          + Add donations
        </button>
      ) : (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
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
              onClick={loadCandidates}
              disabled={loading || !dateFrom || !dateTo}
            >
              {loading ? "Loading…" : "Load"}
            </Button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setAdding(false);
                setCandidates(null);
              }}
            >
              Cancel
            </button>
          </div>

          {loadError && <p className="text-xs text-destructive">{loadError}</p>}

          {candidates &&
            (candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No finalized, unassigned donations in that range.
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
                    <thead className="sticky top-0 bg-muted/30 text-muted-foreground">
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
                <Button
                  size="sm"
                  onClick={addSelected}
                  disabled={busy === "add" || chosen.length === 0}
                >
                  {busy === "add"
                    ? "Adding…"
                    : `Add ${chosen.length} donation${chosen.length === 1 ? "" : "s"}`}
                </Button>
              </>
            ))}
        </div>
      )}
    </div>
  );
}
