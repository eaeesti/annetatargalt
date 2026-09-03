"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

// ── Types (mirror backend statement service) ─────────────────────────────────

type BankTxn = {
  date: string;
  amountCents: number;
  archivingCode: string;
  description: string;
  idOrRegCode: string;
  counterpartyName: string;
};

type RecurringImport = {
  archivingCode: string;
  transaction: BankTxn;
  donorId: number;
  templateId: number;
  templateAmountCents: number;
  amountCents: number;
  datetime: string;
  orgDonations: { organizationInternalId: string; amountCents: number }[];
  amountDrifted: boolean;
};

type ReconcileRow = {
  donationId: number;
  archivingCode: string;
  source: string;
  amountCents: number | null;
  datetime: string | null;
  donorName: string | null;
};

type CardPayout = {
  transaction: BankTxn;
  resolvedDonationIds: number[];
  resolved: boolean;
  grossCents: number | null;
  feeCents: number | null;
};

type Preview = {
  counts: {
    creditTransactions: number;
    alreadyReconciled: number;
    ignored: number;
    unrecorded: number;
    outgoing: number;
  };
  reconcile: ReconcileRow[];
  recurringImports: RecurringImport[];
  cardPayouts: CardPayout[];
  needsDecision: { transaction: BankTxn; reason: string }[];
  notADonation: BankTxn[];
  allCredits: BankTxn[];
  allDebits: BankTxn[];
  donorNames: Record<string, string>;
  orgNames: Record<string, string>;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const eur = (cents: number | null) =>
  cents == null ? "—" : `€${(cents / 100).toFixed(2)}`;

/** "7.37" | "12,50" | "1 234,56" | "1,234.56" → cents, or null. */
function euroInputToCents(raw: string): number | null {
  const s = raw.trim().replace(/[\s ]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized = s;
  if (lastComma > -1 && lastDot > -1) {
    // both present → the later one is the decimal separator
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    normalized = s.split(thou).join("").replace(dec, ".");
  } else if (lastComma > -1) {
    normalized = s.replace(",", "."); // Estonian decimal comma
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        {title} <span className="text-muted-foreground">({count})</span>
      </h2>
      <div className="rounded-md border overflow-x-auto">{children}</div>
    </section>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export function StatementImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{
    created: number;
    reconciled: number;
    ignored: number;
    recorded: number;
  } | null>(null);

  // selections
  const [importSel, setImportSel] = useState<Set<string>>(new Set());
  const [reconcileSel, setReconcileSel] = useState<Set<number>>(new Set());
  const [ignoreSel, setIgnoreSel] = useState<Set<string>>(new Set());
  const [payoutIds, setPayoutIds] = useState<Record<string, string>>({});
  // card-payout code → manually entered fee in euros (only when Montonio didn't resolve)
  const [payoutFees, setPayoutFees] = useState<Record<string, string>>({});
  // needs-a-decision, per archivingCode: assign to an existing donation id,
  // or create a donation from a donor's recurring template
  const [manualAssign, setManualAssign] = useState<Record<string, string>>({});
  const [manualDonor, setManualDonor] = useState<Record<string, string>>({});
  // archivingCodes whose sender→donor mapping should be persisted
  const [rememberSel, setRememberSel] = useState<Set<string>>(new Set());

  async function analyse() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/statement/preview", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? json.error ?? "Failed");
      const p = json as Preview;
      setPreview(p);
      setImportSel(new Set(p.recurringImports.map((i) => i.archivingCode)));
      setReconcileSel(new Set(p.reconcile.map((r) => r.donationId)));
      setIgnoreSel(new Set(p.notADonation.map((t) => t.archivingCode)));
      setManualAssign({});
      setManualDonor({});
      setRememberSel(new Set());
      setPayoutFees({});
      setPayoutIds(
        Object.fromEntries(
          p.cardPayouts
            .filter((c) => c.resolvedDonationIds.length > 0)
            .map((c) => [
              c.transaction.archivingCode,
              c.resolvedDonationIds.join(", "),
            ]),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const cardPayoutAssignments = useMemo(() => {
    const out: { donationId: number; archivingCode: string }[] = [];
    for (const [code, raw] of Object.entries(payoutIds)) {
      for (const part of raw.split(/[^0-9]+/).filter(Boolean)) {
        const id = Number(part);
        if (Number.isInteger(id) && id > 0)
          out.push({ donationId: id, archivingCode: code });
      }
    }
    return out;
  }, [payoutIds]);

  const manualAssignments = useMemo(() => {
    const out: { donationId: number; archivingCode: string; source: string }[] =
      [];
    for (const [code, raw] of Object.entries(manualAssign)) {
      const id = Number(raw.replace(/[^0-9]/g, ""));
      if (Number.isInteger(id) && id > 0)
        out.push({ donationId: id, archivingCode: code, source: "manual" });
    }
    return out;
  }, [manualAssign]);

  const manualRecurring = useMemo(() => {
    if (!preview) return [] as { transaction: BankTxn; donorId: number }[];
    const byCode = new Map(
      preview.needsDecision.map((n) => [
        n.transaction.archivingCode,
        n.transaction,
      ]),
    );
    const out: { transaction: BankTxn; donorId: number }[] = [];
    for (const [code, raw] of Object.entries(manualDonor)) {
      const donorId = Number(raw.replace(/[^0-9]/g, ""));
      const txn = byCode.get(code);
      if (txn && Number.isInteger(donorId) && donorId > 0)
        out.push({ transaction: txn, donorId });
    }
    return out;
  }, [manualDonor, preview]);

  const rememberSenders = useMemo(
    () =>
      manualRecurring
        .filter(
          (mr) =>
            rememberSel.has(mr.transaction.archivingCode) &&
            mr.transaction.idOrRegCode,
        )
        .map((mr) => ({
          senderCode: mr.transaction.idOrRegCode,
          donorId: mr.donorId,
          note: mr.transaction.counterpartyName,
        })),
    [manualRecurring, rememberSel],
  );

  const selectionChanges =
    importSel.size +
    reconcileSel.size +
    ignoreSel.size +
    cardPayoutAssignments.length +
    manualAssignments.length +
    manualRecurring.length;
  // bank_transactions rows that would be written even with nothing selected
  const rowsToRecord = preview?.counts.unrecorded ?? 0;
  const totalChanges = selectionChanges + rowsToRecord;

  async function apply() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        reconcile: [
          ...preview.reconcile
            .filter((r) => reconcileSel.has(r.donationId))
            .map((r) => ({
              donationId: r.donationId,
              archivingCode: r.archivingCode,
              source: r.source,
            })),
          ...manualAssignments,
        ],
        recurringImports: preview.recurringImports.filter((i) =>
          importSel.has(i.archivingCode),
        ),
        manualRecurring,
        rememberSenders,
        cardPayoutAssignments,
        cardPayouts: preview.cardPayouts.map((c) => {
          const code = c.transaction.archivingCode;
          const feeCents = c.resolved
            ? c.feeCents
            : euroInputToCents(payoutFees[code] ?? "");
          return {
            archivingCode: code,
            grossCents: c.grossCents,
            feeCents,
          };
        }),
        ignore: [
          ...preview.notADonation,
          ...preview.needsDecision.map((n) => n.transaction),
        ]
          .filter((t) => ignoreSel.has(t.archivingCode))
          .map((t) => ({
            archivingCode: t.archivingCode,
            reason: t.description,
          })),
        allCredits: preview.allCredits,
        allDebits: preview.allDebits,
      };
      const res = await fetch("/api/statement/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? json.error ?? "Failed");
      setResult(json);
      setPreview(null);
      setFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggle<T>(set: Set<T>, setter: (s: Set<T>) => void, key: T) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="file"
          accept=".csv,text/csv"
          className="max-w-xs"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setResult(null);
          }}
        />
        <Button onClick={analyse} disabled={!file || loading}>
          {loading && !preview ? "Analysing…" : "Analyse"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="rounded-md border border-green-600/30 bg-green-600/5 p-4 text-sm">
          Applied: <strong>{result.created}</strong> donations created,{" "}
          <strong>{result.reconciled}</strong> reconciled,{" "}
          <strong>{result.ignored}</strong> ignored,{" "}
          <strong>{result.recorded}</strong> bank rows recorded.
        </div>
      )}

      {preview && (
        <>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{preview.counts.creditTransactions} credit lines</span>
            <span>{preview.counts.alreadyReconciled} already done</span>
            <span>{preview.counts.ignored} previously ignored</span>
            {preview.counts.unrecorded > 0 && (
              <span className="text-foreground">
                {preview.counts.unrecorded} new bank row
                {preview.counts.unrecorded === 1 ? "" : "s"} will be recorded
              </span>
            )}
            {preview.counts.outgoing > 0 && (
              <span>{preview.counts.outgoing} outgoing (debit) lines</span>
            )}
          </div>

          <Section
            title="Recurring payments → create donation"
            count={preview.recurringImports.length}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Date</TableHead>
                  <TableHead>Donor</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Split</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.recurringImports.map((i) => (
                  <TableRow key={i.archivingCode}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={importSel.has(i.archivingCode)}
                        onChange={() =>
                          toggle(importSel, setImportSel, i.archivingCode)
                        }
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {i.transaction.date}
                    </TableCell>
                    <TableCell>
                      {preview.donorNames[i.donorId] ??
                        i.transaction.counterpartyName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {eur(i.amountCents)}
                      {i.amountDrifted && (
                        <Badge variant="secondary" className="ml-2">
                          template {eur(i.templateAmountCents)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {i.orgDonations
                        .map(
                          (o) =>
                            `${preview.orgNames[o.organizationInternalId] ?? o.organizationInternalId}: ${eur(o.amountCents)}`,
                        )
                        .join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section
            title="Bank transfers → assign transaction ID"
            count={preview.reconcile.length}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Donation</TableHead>
                  <TableHead>Donor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.reconcile.map((r) => (
                  <TableRow key={r.donationId}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={reconcileSel.has(r.donationId)}
                        onChange={() =>
                          toggle(reconcileSel, setReconcileSel, r.donationId)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      #{r.donationId}
                    </TableCell>
                    <TableCell>{r.donorName ?? "—"}</TableCell>
                    <TableCell>{eur(r.amountCents)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.source}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section title="Card payouts" count={preview.cardPayouts.length}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Donation IDs it covers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.cardPayouts.map((c) => (
                  <TableRow key={c.transaction.archivingCode}>
                    <TableCell className="whitespace-nowrap">
                      {c.transaction.date}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {eur(c.transaction.amountCents)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {c.resolved ? (
                        <span className="text-sm">{eur(c.feeCents)}</span>
                      ) : (
                        <Input
                          className="w-24"
                          placeholder="fee €"
                          value={payoutFees[c.transaction.archivingCode] ?? ""}
                          onChange={(e) =>
                            setPayoutFees((m) => ({
                              ...m,
                              [c.transaction.archivingCode]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {c.resolved && (
                        <Badge variant="secondary" className="mr-1">
                          Montonio
                        </Badge>
                      )}
                      {c.transaction.description}
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="e.g. 1648, 1649"
                        value={payoutIds[c.transaction.archivingCode] ?? ""}
                        onChange={(e) =>
                          setPayoutIds((m) => ({
                            ...m,
                            [c.transaction.archivingCode]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section
            title="Needs a decision"
            count={preview.needsDecision.length}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead className="w-32">→ donation #</TableHead>
                  <TableHead className="w-40">→ create for donor #</TableHead>
                  <TableHead className="w-16">Ignore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.needsDecision.map((n) => {
                  const code = n.transaction.archivingCode;
                  const resolved =
                    ignoreSel.has(code) ||
                    !!manualAssign[code]?.trim() ||
                    !!manualDonor[code]?.trim();
                  return (
                    <TableRow key={code}>
                      <TableCell className="whitespace-nowrap">
                        {n.transaction.date}
                      </TableCell>
                      <TableCell>
                        {n.transaction.counterpartyName}
                        <span className="block max-w-xs truncate text-xs text-muted-foreground">
                          {n.transaction.description}
                        </span>
                      </TableCell>
                      <TableCell>{eur(n.transaction.amountCents)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {n.reason}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="#"
                          value={manualAssign[code] ?? ""}
                          disabled={
                            ignoreSel.has(code) || !!manualDonor[code]?.trim()
                          }
                          onChange={(e) =>
                            setManualAssign((m) => ({
                              ...m,
                              [code]: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="donor #"
                          value={manualDonor[code] ?? ""}
                          disabled={
                            ignoreSel.has(code) || !!manualAssign[code]?.trim()
                          }
                          onChange={(e) =>
                            setManualDonor((m) => ({
                              ...m,
                              [code]: e.target.value,
                            }))
                          }
                        />
                        {!!manualDonor[code]?.trim() &&
                          !!n.transaction.idOrRegCode && (
                            <label className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={rememberSel.has(code)}
                                onChange={() =>
                                  toggle(rememberSel, setRememberSel, code)
                                }
                              />
                              remember {n.transaction.idOrRegCode}
                            </label>
                          )}
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={ignoreSel.has(code)}
                          onChange={() => toggle(ignoreSel, setIgnoreSel, code)}
                        />
                        {!resolved && (
                          <span
                            className="ml-1 text-xs text-amber-600"
                            title="unresolved — will not be touched"
                          >
                            •
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Section>

          <Section
            title="Not a donation → ignore"
            count={preview.notADonation.length}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Date</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.notADonation.map((t) => (
                  <TableRow key={t.archivingCode}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={ignoreSel.has(t.archivingCode)}
                        onChange={() =>
                          toggle(ignoreSel, setIgnoreSel, t.archivingCode)
                        }
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.date}
                    </TableCell>
                    <TableCell>{t.counterpartyName}</TableCell>
                    <TableCell>{eur(t.amountCents)}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {t.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <div className="sticky bottom-0 flex items-center gap-3 border-t bg-background/95 py-3">
            <Button onClick={apply} disabled={loading || totalChanges === 0}>
              {loading
                ? "Applying…"
                : selectionChanges === 0 && rowsToRecord > 0
                  ? `Record ${rowsToRecord} bank row${rowsToRecord === 1 ? "" : "s"}`
                  : `Apply ${selectionChanges} change${selectionChanges === 1 ? "" : "s"}`}
            </Button>
            <span className="text-xs text-muted-foreground">
              {importSel.size + manualRecurring.length} create ·{" "}
              {reconcileSel.size + manualAssignments.length} reconcile ·{" "}
              {cardPayoutAssignments.length} card · {ignoreSel.size} ignore
              {rowsToRecord > 0 && <> · {rowsToRecord} bank rows</>}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
