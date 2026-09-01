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

type Preview = {
  counts: {
    creditTransactions: number;
    alreadyReconciled: number;
    ignored: number;
  };
  reconcile: ReconcileRow[];
  recurringImports: RecurringImport[];
  cardPayouts: BankTxn[];
  needsDecision: { transaction: BankTxn; reason: string }[];
  notADonation: BankTxn[];
  donorNames: Record<string, string>;
  orgNames: Record<string, string>;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const eur = (cents: number | null) =>
  cents == null ? "—" : `€${(cents / 100).toFixed(2)}`;

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
  } | null>(null);

  // selections
  const [importSel, setImportSel] = useState<Set<string>>(new Set());
  const [reconcileSel, setReconcileSel] = useState<Set<number>>(new Set());
  const [ignoreSel, setIgnoreSel] = useState<Set<string>>(new Set());
  const [payoutIds, setPayoutIds] = useState<Record<string, string>>({});

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
      setPayoutIds({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const cardPayoutAssignments = useMemo(() => {
    const out: { donationId: number; archivingCode: string }[] = [];
    for (const [code, raw] of Object.entries(payoutIds)) {
      for (const part of raw.split(/[\s,]+/).filter(Boolean)) {
        const id = Number(part);
        if (Number.isInteger(id))
          out.push({ donationId: id, archivingCode: code });
      }
    }
    return out;
  }, [payoutIds]);

  const totalChanges =
    importSel.size +
    reconcileSel.size +
    ignoreSel.size +
    cardPayoutAssignments.length;

  async function apply() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        reconcile: preview.reconcile
          .filter((r) => reconcileSel.has(r.donationId))
          .map((r) => ({
            donationId: r.donationId,
            archivingCode: r.archivingCode,
            source: r.source,
          })),
        recurringImports: preview.recurringImports.filter((i) =>
          importSel.has(i.archivingCode),
        ),
        cardPayoutAssignments,
        ignore: preview.notADonation
          .filter((t) => ignoreSel.has(t.archivingCode))
          .map((t) => ({
            archivingCode: t.archivingCode,
            reason: t.description,
          })),
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
          <strong>{result.ignored}</strong> ignored.
        </div>
      )}

      {preview && (
        <>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{preview.counts.creditTransactions} credit lines</span>
            <span>{preview.counts.alreadyReconciled} already done</span>
            <span>{preview.counts.ignored} previously ignored</span>
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
                  <TableHead>Reference</TableHead>
                  <TableHead>Donation IDs it covers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.cardPayouts.map((t) => (
                  <TableRow key={t.archivingCode}>
                    <TableCell className="whitespace-nowrap">
                      {t.date}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {eur(t.amountCents)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {t.description}
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="e.g. 1648, 1649"
                        value={payoutIds[t.archivingCode] ?? ""}
                        onChange={(e) =>
                          setPayoutIds((m) => ({
                            ...m,
                            [t.archivingCode]: e.target.value,
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
            title="Needs a decision — handle these outside this tool"
            count={preview.needsDecision.length}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.needsDecision.map((n) => (
                  <TableRow key={n.transaction.archivingCode}>
                    <TableCell className="whitespace-nowrap">
                      {n.transaction.date}
                    </TableCell>
                    <TableCell>{n.transaction.counterpartyName}</TableCell>
                    <TableCell>{eur(n.transaction.amountCents)}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {n.transaction.description}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {n.reason}
                    </TableCell>
                  </TableRow>
                ))}
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
                : `Apply ${totalChanges} change${totalChanges === 1 ? "" : "s"}`}
            </Button>
            <span className="text-xs text-muted-foreground">
              {importSel.size} create · {reconcileSel.size} reconcile ·{" "}
              {cardPayoutAssignments.length} card · {ignoreSel.size} ignore
            </span>
          </div>
        </>
      )}
    </div>
  );
}
