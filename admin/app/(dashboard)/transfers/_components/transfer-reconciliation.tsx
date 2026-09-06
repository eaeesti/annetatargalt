"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";

type LinkedPayment = {
  archivingCode: string;
  date: string | null;
  amountCents: number | null;
  counterpartyName: string | null;
  description: string | null;
};

const eur = (c: number | null) =>
  c == null ? "—" : `€${(Math.abs(c) / 100).toFixed(2)}`;

const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

/** transfer date ± weeks, as YYYY-MM-DD */
function windowAround(iso: string, weeksBefore: number, weeksAfter: number) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const from = new Date(d);
  from.setUTCDate(from.getUTCDate() - weeksBefore * 7);
  const to = new Date(d);
  to.setUTCDate(to.getUTCDate() + weeksAfter * 7);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function TransferReconciliation({
  transferId,
  transferDate,
  owedCents,
  paidOutCents,
  differenceCents,
  balanced,
  linked,
}: {
  transferId: number;
  transferDate: string;
  owedCents: number;
  paidOutCents: number;
  differenceCents: number;
  balanced: boolean;
  linked: LinkedPayment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [candidates, setCandidates] = useState<
    LinkedPayment[] | "loading" | "error"
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const hasPayments = linked.length > 0;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message ?? "Request failed");
        return;
      }
      setPicker(false);
      setSelected(new Set());
      router.refresh();
    } catch {
      alert("Request failed — check your connection and try again");
    } finally {
      setBusy(false);
    }
  }

  async function openPicker() {
    setPicker(true);
    setCandidates("loading");
    const { from, to } = windowAround(transferDate, 3, 8);
    try {
      const res = await fetch(
        `/api/transfers/unlinked-outgoing?dateFrom=${from}&dateTo=${to}`,
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCandidates(json.data as LinkedPayment[]);
    } catch {
      setCandidates("error");
    }
  }

  const selectedTotal = Array.isArray(candidates)
    ? candidates
        .filter((c) => selected.has(c.archivingCode))
        .reduce((s, c) => s + Math.abs(c.amountCents ?? 0), 0)
    : 0;

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Reconciliation
      </h2>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span>
          Owed to orgs{" "}
          <span className="font-semibold tabular-nums">{eur(owedCents)}</span>
        </span>
        <span>
          Paid out{" "}
          <span className="font-semibold tabular-nums">
            {eur(paidOutCents)}
          </span>
        </span>
        <span
          className={
            !hasPayments
              ? "text-muted-foreground"
              : balanced
                ? "text-emerald-600"
                : "text-amber-600"
          }
        >
          Difference{" "}
          <span className="font-semibold tabular-nums">
            {differenceCents >= 0 ? "" : "−"}
            {eur(differenceCents)}
          </span>
          {hasPayments && (balanced ? " ✓" : " — needs a look")}
        </span>
      </div>
      {hasPayments && !balanced && (
        <p className="text-xs text-muted-foreground">
          A small negative difference is normal — card fees are absorbed and the
          outgoing SEPA carries its own fee. A large gap means a payment is
          missing or attached to the wrong round.
        </p>
      )}

      {linked.length > 0 ? (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="py-1 pr-3">Date</th>
              <th className="py-1 pr-3">Counterparty</th>
              <th className="py-1 pr-3 text-right">Amount</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {linked.map((p) => (
              <tr key={p.archivingCode} className="border-t border-border/50">
                <td className="py-1 pr-3 whitespace-nowrap">
                  {fmtDate(p.date)}
                </td>
                <td className="py-1 pr-3">{p.counterpartyName ?? "—"}</td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {eur(p.amountCents)}
                </td>
                <td className="py-1 text-right">
                  <button
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    disabled={busy}
                    onClick={() => patch({ unlinkCodes: [p.archivingCode] })}
                  >
                    Unlink
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-muted-foreground">
          No bank payments linked yet.
        </p>
      )}

      {!picker && (
        <Button
          size="sm"
          variant="outline"
          onClick={openPicker}
          disabled={busy}
        >
          Link a payment
        </Button>
      )}

      {picker && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Unlinked outgoing transactions near {fmtDate(transferDate)}
            </span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setPicker(false)}
            >
              Close
            </button>
          </div>

          {candidates === "loading" && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
          {candidates === "error" && (
            <p className="text-xs text-destructive">Failed to load.</p>
          )}
          {Array.isArray(candidates) && candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No unlinked outgoing transactions in this window.
            </p>
          )}
          {Array.isArray(candidates) && candidates.length > 0 && (
            <>
              <table className="w-full text-xs">
                <tbody>
                  {candidates.map((c) => (
                    <tr
                      key={c.archivingCode}
                      className="border-t border-border/50"
                    >
                      <td className="py-1 pr-2">
                        <input
                          type="checkbox"
                          checked={selected.has(c.archivingCode)}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(c.archivingCode);
                              else next.delete(c.archivingCode);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="py-1 pr-3 whitespace-nowrap">
                        {fmtDate(c.date)}
                      </td>
                      <td className="py-1 pr-3">{c.counterpartyName ?? "—"}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">
                        {eur(c.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {selected.size} selected · {eur(selectedTotal)}
                </span>
                <Button
                  size="sm"
                  disabled={busy || selected.size === 0}
                  onClick={() => patch({ linkCodes: [...selected] })}
                >
                  {busy ? "Linking…" : "Link selected"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
