"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { formatEuros } from "../../../../lib/money";
import { ReconciledMark } from "./reconciled-mark";
import { CandidatePicker } from "./candidate-picker";
import { formatDateTime } from "../../../../lib/dates";
import { ConfirmButton } from "../../../../components/confirm-button";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../lib/failure-message";

type Row = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  transactionId: string | null;
  processorFeeCents: number | null;
  orgLabel: string;
};

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
  const [adding, setAdding] = useState(false);
  const [busyAdding, setBusyAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  /** null when it worked, else what went wrong */
  async function patch(body: Record<string, unknown>): Promise<string | null> {
    const res = await fetch(`/api/transfers/${transferId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return failureMessage(res, "Couldn't save the change.");
    router.refresh();
    return null;
  }

  async function addSelected(ids: number[]) {
    if (ids.length === 0) return;
    setBusyAdding(true);
    setAddError(null);
    try {
      const failed = await patch({ addDonationIds: ids });
      if (failed) setAddError(failed);
      else setAdding(false);
    } catch {
      setAddError(CONNECTION_FAILED);
    } finally {
      setBusyAdding(false);
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
              className="-mx-2 flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
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
                  {formatDateTime(d.datetime)}
                </span>
                {!d.finalized && (
                  <Badge variant="destructive" className="text-xs">
                    Not finalized
                  </Badge>
                )}
              </Link>
              <div className="flex min-w-0 items-center gap-3">
                {d.orgLabel && (
                  <span
                    title={d.orgLabel}
                    className="hidden max-w-48 truncate text-xs text-muted-foreground sm:block"
                  >
                    {d.orgLabel}
                  </span>
                )}
                <span className="text-right font-medium tabular-nums">
                  {formatEuros(d.amount)}
                  {typeof d.processorFeeCents === "number" && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      fee {formatEuros(d.processorFeeCents)}
                    </span>
                  )}
                </span>
                <ConfirmButton
                  title={`Remove donation #${d.id} from transfer #${transferId}?`}
                  description="It goes back to the donations not yet transferred."
                  confirmLabel="Remove"
                  action={() => patch({ removeDonationIds: [d.id] })}
                  trigger={
                    <button
                      className="text-xs text-muted-foreground hover:text-destructive"
                      aria-label={`Remove donation #${d.id} from this transfer`}
                    />
                  }
                >
                  Remove
                </ConfirmButton>
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
              <span className="inline-flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => addSelected(chosen.map((c) => c.id))}
                  disabled={busyAdding || chosen.length === 0}
                >
                  {busyAdding
                    ? "Adding…"
                    : `Add ${chosen.length} donation${chosen.length === 1 ? "" : "s"}`}
                </Button>
                {addError && (
                  <span role="alert" className="text-xs text-destructive">
                    {addError}
                  </span>
                )}
              </span>
            )}
          </CandidatePicker>
        </div>
      )}
    </div>
  );
}
