"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { formatEuros } from "../../../../lib/money";
import { CandidatePicker, type Candidate } from "./candidate-picker";

const today = () => new Date().toISOString().slice(0, 10);

function perOrgTotals(chosen: Candidate[]): [string, number][] {
  const m = new Map<string, number>();
  for (const c of chosen)
    for (const o of c.orgSplit)
      m.set(o.internalId, (m.get(o.internalId) ?? 0) + o.amountCents);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function TransferBuilder({
  defaultFrom,
  orgNames = {},
}: {
  defaultFrom?: string;
  orgNames?: Record<string, string>;
}) {
  const router = useRouter();

  const [chosen, setChosen] = useState<Candidate[]>([]);
  const [transferDate, setTransferDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Seed from a date range
        </h2>
        <CandidatePicker
          defaultFrom={defaultFrom}
          defaultTo={today()}
          preselectAll
          onChange={setChosen}
          // the round is conventionally dated at the end of the period it covers
          onLoad={({ to }) => setTransferDate(to)}
        >
          {(sel) => {
            const total = sel.reduce((s, c) => s + c.amountCents, 0);
            const unreconciled = sel.filter((c) => !c.reconciled).length;
            const perOrg = perOrgTotals(sel);
            return (
              <div className="space-y-2 border-t pt-3">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <span>
                    Total{" "}
                    <span className="font-semibold tabular-nums">
                      {formatEuros(total)}
                    </span>
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
                          <a
                            href={`/organizations/${encodeURIComponent(id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {orgNames[id] ?? id}
                          </a>
                          <span className="tabular-nums">
                            {formatEuros(amt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          }}
        </CandidatePicker>
      </div>

      {chosen.length > 0 && (
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
