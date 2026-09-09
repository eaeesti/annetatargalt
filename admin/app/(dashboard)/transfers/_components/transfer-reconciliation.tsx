"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { EntityLink } from "../../../../components/entity-link";
import { bankTransactionHref } from "../../../../lib/entity-links";

type LinkedPayment = {
  archivingCode: string;
  date: string | null;
  amountCents: number | null;
  counterpartyName: string | null;
  description: string | null;
  note: string | null;
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

  const win = windowAround(transferDate, 3, 8);
  const [from, setFrom] = useState(win.from);
  const [to, setTo] = useState(win.to);
  const [search, setSearch] = useState("");

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

  // per-payment note edits (which org the payment went to) — keyed by code
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(linked.map((p) => [p.archivingCode, p.note ?? ""])),
  );
  const [savingNote, setSavingNote] = useState<string | null>(null);

  async function saveNote(code: string, original: string) {
    const value = (notes[code] ?? "").trim();
    if (value === (original ?? "").trim()) return;
    setSavingNote(code);
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: value || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message ?? "Could not save the note");
      } else {
        router.refresh();
      }
    } catch {
      alert("Could not save the note — check your connection and try again");
    } finally {
      setSavingNote(null);
    }
  }

  const loadCandidates = useCallback(async () => {
    setCandidates("loading");
    const qs = new URLSearchParams();
    if (from) qs.set("dateFrom", from);
    if (to) qs.set("dateTo", to);
    if (search.trim()) qs.set("search", search.trim());
    try {
      const res = await fetch(`/api/transfers/unlinked-outgoing?${qs}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCandidates(json.data as LinkedPayment[]);
    } catch {
      setCandidates("error");
    }
  }, [from, to, search]);

  // refetch when the picker is open and a filter changes (debounced)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!picker) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(loadCandidates, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [picker, loadCandidates]);

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
              <th className="py-1 pr-3">Note</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {linked.map((p) => (
              <tr key={p.archivingCode} className="border-t border-border/50">
                <td className="py-1 pr-3 whitespace-nowrap">
                  <EntityLink
                    href={bankTransactionHref(p.archivingCode)}
                    newTab
                  >
                    {fmtDate(p.date)}
                  </EntityLink>
                </td>
                <td className="py-1 pr-3">{p.counterpartyName ?? "—"}</td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {eur(p.amountCents)}
                </td>
                <td className="py-1 pr-3">
                  <Input
                    value={notes[p.archivingCode] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({
                        ...n,
                        [p.archivingCode]: e.target.value,
                      }))
                    }
                    onBlur={() => saveNote(p.archivingCode, p.note ?? "")}
                    disabled={savingNote === p.archivingCode}
                    className="h-6 rounded-md px-1.5 py-0 text-xs"
                  />
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
          onClick={() => setPicker(true)}
          disabled={busy}
        >
          Link a payment
        </Button>
      )}

      {picker && (
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Unlinked outgoing transactions
            </span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setPicker(false)}
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">From</span>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-7 w-36 text-xs"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">To</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-7 w-36 text-xs"
              />
            </label>
            <label className="flex-1 text-xs">
              <span className="mb-1 block text-muted-foreground">Search</span>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="counterparty / description / code"
                className="h-7 text-xs"
              />
            </label>
            <button
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFrom("");
                setTo("");
                setSearch("");
              }}
            >
              Clear
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
              No unlinked outgoing transactions match.
            </p>
          )}
          {Array.isArray(candidates) && candidates.length > 0 && (
            <>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {candidates.map((c) => (
                      <tr
                        key={c.archivingCode}
                        className="border-t border-border/50"
                      >
                        <td className="py-1 pr-2 align-top">
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
                        <td className="py-1 pr-3 whitespace-nowrap align-top">
                          <EntityLink
                            href={bankTransactionHref(c.archivingCode)}
                            newTab
                          >
                            {fmtDate(c.date)}
                          </EntityLink>
                        </td>
                        <td className="py-1 pr-3">
                          <span className="block">
                            {c.counterpartyName ?? "—"}
                          </span>
                          {c.description && (
                            <span className="block text-muted-foreground">
                              {c.description}
                            </span>
                          )}
                        </td>
                        <td className="py-1 pr-3 text-right tabular-nums align-top">
                          {eur(c.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {candidates.length} shown · {selected.size} selected ·{" "}
                  {eur(selectedTotal)}
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
