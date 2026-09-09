"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { EntityLink } from "../../../../components/entity-link";
import { bankTransactionHref } from "../../../../lib/entity-links";
import { euroInputToCents } from "../../../../lib/money";

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
  adjustmentCents,
  reconciliationNote,
  residualCents,
  balanced,
  linked,
}: {
  transferId: number;
  transferDate: string;
  owedCents: number;
  paidOutCents: number;
  adjustmentCents: number | null;
  reconciliationNote: string | null;
  residualCents: number;
  balanced: boolean | null;
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
  const serverNotes = Object.fromEntries(
    linked.map((p) => [p.archivingCode, p.note ?? ""]),
  );
  const [notes, setNotes] = useState<Record<string, string>>(serverNotes);
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const seenServerNotes = useRef<Record<string, string>>(serverNotes);

  // After a refresh (link / unlink / save), adopt the server's notes for rows
  // the operator hasn't touched, but keep any unsaved local edit that diverges
  // from what the server last showed us. Keyed on a value signature so it fires
  // only when the data actually changed, not on every render.
  const linkedSig = linked
    .map((p) => `${p.archivingCode}:${p.note ?? ""}`)
    .join("|");
  useEffect(() => {
    setNotes((local) => {
      const merged: Record<string, string> = {};
      for (const [code, srv] of Object.entries(serverNotes)) {
        const seen = seenServerNotes.current[code] ?? "";
        const loc = local[code];
        merged[code] = loc !== undefined && loc !== seen ? loc : srv;
      }
      return merged;
    });
    seenServerNotes.current = serverNotes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedSig]);

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

  // ── manual reconciliation adjustment ──────────────────────────────────────
  const [editAdj, setEditAdj] = useState(false);
  const [adjEuros, setAdjEuros] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [savingAdj, setSavingAdj] = useState(false);
  const assessed = hasPayments || adjustmentCents !== null;

  const signed = (cents: number) => `${cents < 0 ? "−" : ""}${eur(cents)}`;

  // seed the form from the current server values each time it opens, so a
  // refresh (Clear, linking a payment) can't leave stale values in it
  function toggleEditAdj() {
    if (!editAdj) {
      setAdjEuros(
        adjustmentCents == null ? "" : (adjustmentCents / 100).toFixed(2),
      );
      setAdjNote(reconciliationNote ?? "");
    }
    setEditAdj((v) => !v);
  }

  async function saveAdjustment(clear = false) {
    let cents: number | null = null;
    if (!clear) {
      cents = euroInputToCents(adjEuros);
      if (cents === null) {
        alert("Enter an amount — e.g. -1234.56, or 0 for none");
        return;
      }
    }
    setSavingAdj(true);
    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reconciliationAdjustmentCents: cents,
          reconciliationNote: clear ? null : adjNote.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message ?? "Could not save the adjustment");
        return;
      }
      setEditAdj(false);
      router.refresh();
    } catch {
      alert("Could not save — check your connection and try again");
    } finally {
      setSavingAdj(false);
    }
  }

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
          className={adjustmentCents === null ? "text-muted-foreground" : ""}
        >
          Adjustment{" "}
          <span className="font-semibold tabular-nums">
            {adjustmentCents === null ? "—" : signed(adjustmentCents)}
          </span>{" "}
          <button
            className="text-xs text-primary hover:underline"
            onClick={toggleEditAdj}
          >
            {editAdj ? "close" : adjustmentCents === null ? "set" : "edit"}
          </button>
        </span>
        <span
          className={
            !assessed
              ? "text-muted-foreground"
              : balanced
                ? "text-emerald-600"
                : "text-amber-600"
          }
        >
          Residual{" "}
          <span className="font-semibold tabular-nums">
            {signed(residualCents)}
          </span>
          {assessed && (balanced ? " ✓" : " — needs a look")}
        </span>
      </div>

      {reconciliationNote && !editAdj && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Adjustment note:</span>{" "}
          {reconciliationNote}
        </p>
      )}

      {editAdj && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Record the part of <em>owed</em> that legitimately didn&apos;t leave
            via a linked payment — a payout the imported statements don&apos;t
            cover, or absorbed fees. Use a negative number when a linked payment
            over-covers this round, or 0 if you&apos;ve checked it and
            there&apos;s nothing to adjust.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">
                Adjustment (€)
              </span>
              <Input
                value={adjEuros}
                onChange={(e) => setAdjEuros(e.target.value)}
                placeholder="e.g. -1234.56"
                className="h-7 w-40 text-xs"
              />
            </label>
            <label className="flex-1 text-xs">
              <span className="mb-1 block text-muted-foreground">
                Why (required)
              </span>
              <Input
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                className="h-7 text-xs"
              />
            </label>
            <Button
              size="sm"
              disabled={savingAdj || !adjEuros.trim() || !adjNote.trim()}
              onClick={() => saveAdjustment(false)}
            >
              {savingAdj ? "Saving…" : "Save"}
            </Button>
            {adjustmentCents !== null && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingAdj}
                onClick={() => saveAdjustment(true)}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {assessed && !balanced && !editAdj && (
        <p className="text-xs text-muted-foreground">
          A small residual is normal — card fees are absorbed and the outgoing
          SEPA carries its own fee. A larger gap means a payment is missing, on
          the wrong round, or something that belongs in the adjustment.
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
