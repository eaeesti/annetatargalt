"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { formatEuros } from "../../../../lib/money";
import { ReconciledMark } from "./reconciled-mark";
import { CandidatePicker } from "./candidate-picker";

type Row = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  transactionId: string | null;
  orgLabel: string;
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

  async function addSelected(ids: number[]) {
    if (ids.length === 0) return;
    setBusy("add");
    try {
      if (await patch({ addDonationIds: ids })) {
        setAdding(false);
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
                  {fmtDateTime(d.datetime)}
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
                  {formatEuros(d.amount)}
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
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Add finalized, not-yet-transferred donations to this round
            </span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
          <CandidatePicker
            defaultFrom={shiftDays(transferDate, -90)}
            defaultTo={transferDate.slice(0, 10)}
            loadLabel="Load"
          >
            {(chosen) => (
              <Button
                size="sm"
                onClick={() => addSelected(chosen.map((c) => c.id))}
                disabled={busy === "add" || chosen.length === 0}
              >
                {busy === "add"
                  ? "Adding…"
                  : `Add ${chosen.length} donation${chosen.length === 1 ? "" : "s"}`}
              </Button>
            )}
          </CandidatePicker>
        </div>
      )}
    </div>
  );
}
