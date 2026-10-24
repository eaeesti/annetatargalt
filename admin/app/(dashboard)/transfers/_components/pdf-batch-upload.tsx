"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { matchPayment } from "../../../../lib/match-files";
import { formatBytes, uploadPdf } from "../../../../lib/pdf-upload";

type Payment = {
  archivingCode: string;
  date: string | null;
  amountCents: number | null;
  counterpartyName: string | null;
  description: string | null;
  /** the PDF it already has; a payment takes one */
  file: { id: number } | null;
};

type Row = {
  id: number;
  file: File;
  /** archiving code of the chosen payment; "" for none yet */
  code: string;
  /** how the file name matched, or why it wasn't given the payment it matched */
  hint: string | null;
  status: "waiting" | "uploading" | "attached" | "failed";
  error: string | null;
};

const paymentLabel = (p: Payment) =>
  [
    p.date?.slice(0, 10) ?? "—",
    p.counterpartyName ?? "—",
    typeof p.amountCents === "number"
      ? `€${(Math.abs(p.amountCents) / 100).toFixed(2)}`
      : "—",
  ].join(" · ");

/**
 * PDFs for several of the round's payments at once. Each file is matched to
 * a payment by a reference in its name that's also in the payment's bank
 * description; the rest are assigned by hand. A payment takes one PDF, so
 * those that have one can't be chosen, and only one file can go to each.
 * Nothing is attached until the operator confirms.
 */
export function PdfBatchUpload({
  payments,
  onClose,
}: {
  payments: Payment[];
  onClose: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);

  const hasPdf = (code: string) =>
    payments.some((p) => p.archivingCode === code && p.file !== null);

  function add(files: File[]) {
    const kept = rows.filter((r) => r.status !== "attached");
    // payments another file is already going to
    const claimed = new Set(kept.map((r) => r.code).filter(Boolean));
    const added = files.map((file): Row => {
      const match = matchPayment(file.name, payments);
      let code = "";
      let hint: string | null = null;
      if (match && hasPdf(match)) {
        hint = "Its payment already has a PDF.";
      } else if (match && claimed.has(match)) {
        hint = "Another file is already going to its payment.";
      } else if (match) {
        code = match;
        hint = "Matched by reference";
        claimed.add(match);
      }
      return {
        id: nextId.current++,
        file,
        code,
        hint,
        status: "waiting",
        error: null,
      };
    });
    setRows([...kept, ...added]);
  }

  const update = (id: number, change: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));

  // the file each payment takes: the first one chosen for it
  const firstFor = new Map<string, number>();
  for (const r of rows) {
    if (r.code && !firstFor.has(r.code)) firstFor.set(r.code, r.id);
  }
  /** why the row's file can't go to the payment chosen for it */
  const blocked = (r: Row): string | null => {
    if (!r.code || r.status === "attached") return null;
    if (hasPdf(r.code)) return "This payment already has a PDF.";
    if (firstFor.get(r.code) !== r.id) {
      return "Another file is already going to this payment.";
    }
    return null;
  };

  const waiting = rows.filter((r) => r.status !== "attached");
  const toAttach = waiting.filter((r) => r.code && !blocked(r));
  const unassigned = waiting.filter((r) => !r.code || blocked(r));

  async function attachAll() {
    setRunning(true);
    for (const row of toAttach) {
      update(row.id, { status: "uploading", error: null });
      const problem = await uploadPdf(row.code, row.file);
      update(
        row.id,
        problem
          ? { status: "failed", error: problem }
          : { status: "attached", error: null },
      );
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-md border p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          PDFs for this round&apos;s payments
        </span>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
          disabled={running}
        >
          Close
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-2 rounded-md border border-dashed p-4 text-center ${
          dragging ? "border-primary bg-primary/5" : ""
        }`}
      >
        <Upload className="size-4 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">
          Drop PDFs here, or{" "}
          <button
            className="text-primary hover:underline"
            onClick={() => input.current?.click()}
          >
            choose files
          </button>
          . A file whose name has a reference from a payment&apos;s description,
          such as the recipient&apos;s code, goes to that payment. Each payment
          takes one PDF.
        </p>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1 border-t border-border/50 pt-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 basis-48 truncate">
                  {r.file.name}{" "}
                  <span className="text-muted-foreground">
                    {formatBytes(r.file.size)}
                  </span>
                </span>
                <span className="flex w-full items-center gap-2 sm:w-auto">
                  <select
                    className="min-w-0 flex-1 rounded border bg-background px-2 py-1 sm:w-80 sm:flex-none"
                    value={r.code}
                    disabled={running || r.status === "attached"}
                    aria-label={`Payment for ${r.file.name}`}
                    onChange={(e) =>
                      update(r.id, {
                        code: e.target.value,
                        hint: null,
                        status: "waiting",
                        error: null,
                      })
                    }
                  >
                    <option value="">Choose a payment…</option>
                    {payments.map((p) => (
                      <option
                        key={p.archivingCode}
                        value={p.archivingCode}
                        disabled={p.file !== null}
                      >
                        {paymentLabel(p)}
                        {p.file !== null ? " · has a PDF" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className="text-muted-foreground hover:text-destructive disabled:invisible"
                    disabled={running || r.status === "attached"}
                    onClick={() =>
                      setRows((prev) => prev.filter((x) => x.id !== r.id))
                    }
                    aria-label={`Leave out ${r.file.name}`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              </div>
              {(r.status !== "waiting" || blocked(r) || r.hint) && (
                <p
                  role={r.status === "failed" ? "alert" : undefined}
                  className={
                    r.status === "failed" || blocked(r)
                      ? "text-destructive"
                      : r.status === "attached"
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                  }
                >
                  {r.status === "uploading"
                    ? "Attaching…"
                    : r.status === "attached"
                      ? "Attached ✓"
                      : r.status === "failed"
                        ? r.error
                        : (blocked(r) ?? r.hint)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {(toAttach.length > 0 || unassigned.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-muted-foreground">
            {unassigned.length > 0 &&
              `${unassigned.length} file${unassigned.length !== 1 ? "s" : ""} without a payment of ${unassigned.length !== 1 ? "their" : "its"} own won't be attached.`}
          </span>
          <Button
            size="sm"
            disabled={running || toAttach.length === 0}
            onClick={attachAll}
          >
            {running
              ? "Attaching…"
              : `Attach ${toAttach.length} PDF${toAttach.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
