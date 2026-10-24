"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../lib/failure-message";

export function TransferMetaEditor({
  transferId,
  datetime,
  notes,
}: {
  transferId: number;
  datetime: string;
  notes: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(datetime.slice(0, 10));
  const [note, setNote] = useState(notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datetime: date, notes: note || null }),
      });
      if (!res.ok) {
        setError(await failureMessage(res, "Couldn't save the change."));
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError(CONNECTION_FAILED);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setEditing(true)}
      >
        Edit date / notes
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">Date</span>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
      </label>
      <label className="flex-1 text-xs">
        <span className="mb-1 block text-muted-foreground">Notes</span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button size="sm" onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        disabled={busy}
      >
        Cancel
      </Button>
      {error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
