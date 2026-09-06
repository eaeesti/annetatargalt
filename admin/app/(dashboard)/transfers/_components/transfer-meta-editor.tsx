"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";

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

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datetime: date, notes: note || null }),
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
        onClick={() => setEditing(false)}
        disabled={busy}
      >
        Cancel
      </Button>
    </div>
  );
}
