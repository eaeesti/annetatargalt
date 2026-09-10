"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { EntityLink } from "../../../../components/entity-link";
import { transferHref } from "../../../../lib/entity-links";

/**
 * The "Transfer" field on a donation — shows the round it's on and lets an
 * operator move it to another round or clear it. Backed by
 * `PATCH /api/donations/:id { donationTransferId }`.
 */
export function DonationTransferEditor({
  donationId,
  transferId,
  finalized,
}: {
  donationId: number;
  transferId: number | null;
  finalized: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(transferId ? String(transferId) : "");
  const [busy, setBusy] = useState(false);

  async function save(next: number | null) {
    setBusy(true);
    try {
      const res = await fetch(`/api/donations/${donationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donationTransferId: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message ?? "Failed to save");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      alert("Failed to save — check your connection and try again");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        {transferId ? (
          <EntityLink href={transferHref(transferId)}>#{transferId}</EntityLink>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            setValue(transferId ? String(transferId) : "");
            setEditing(true);
          }}
        >
          Change
        </button>
      </span>
    );
  }

  const parsed = Number(value);
  const validNew =
    finalized &&
    value.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed > 0 &&
    parsed !== transferId;

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Transfer #"
        className="h-7 w-28"
      />
      <Button
        size="sm"
        disabled={busy || !validNew}
        onClick={() => save(parsed)}
      >
        {busy ? "Saving…" : "Save"}
      </Button>
      {transferId !== null && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => save(null)}
        >
          Clear
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setEditing(false)}
      >
        Cancel
      </Button>
      {!finalized && (
        <span className="text-xs text-amber-600">
          Not finalized — can only be cleared, not added to a round
        </span>
      )}
    </span>
  );
}
