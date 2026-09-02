/**
 * Bank-statement categoriser — turns a parsed LHV statement + current DB state
 * into a review plan for the admin "statement import" tool.
 *
 * Pure: no DB, no `strapi`, no network. The caller supplies current DB state
 * (unreconciled donations, already-used archiving codes, the ignore list, and a
 * donor→templates lookup) and, later, resolved card payouts.
 *
 * Builds on `reconciliation.ts` (`matchDonations`) for the "assign a code to an
 * existing donation" case.
 */
import {
  matchDonations,
  type BankTransaction,
  type ReconcilableDonation,
  type MatchSource,
} from "./reconciliation";
import { resizeOrganizationDonations } from "./donation";

// ─── Injected DB shapes ──────────────────────────────────────────────────────

export interface RecurringTemplate {
  id: number;
  donorId: number;
  /** ISO datetime the template was created */
  datetime: string;
  /** template amount, cents */
  amount: number;
  companyName: string | null;
  companyCode: string | null;
  bank: string | null;
  /** organization split, cents, sums to `amount` */
  orgSplit: { organizationInternalId: string; amount: number }[];
}

export interface DonorTemplates {
  donorId: number;
  /** newest first */
  templates: RecurringTemplate[];
}

export interface StatementInput {
  transactions: BankTransaction[];
  /** finalized donations that do NOT yet have a transaction_id */
  unreconciledDonations: ReconcilableDonation[];
  /** archiving codes already recorded on some donation */
  reconciledCodes: Set<string>;
  /** archiving codes in `ignored_bank_transactions` */
  ignoredCodes: Set<string>;
  /** idCode OR company code → that donor and their templates (newest first) */
  donorsByCode: Map<string, DonorTemplates>;
}

// ─── Report ──────────────────────────────────────────────────────────────────

export interface PlannedOrgDonation {
  organizationInternalId: string;
  amountCents: number;
}

export interface RecurringImport {
  archivingCode: string;
  transaction: BankTransaction;
  donorId: number;
  templateId: number;
  templateAmountCents: number;
  amountCents: number;
  /** ISO datetime for the new donation (transaction date, noon local) */
  datetime: string;
  companyName: string | null;
  companyCode: string | null;
  paymentMethod: string | null;
  iban: string;
  orgDonations: PlannedOrgDonation[];
  /** true when the paid amount differs from the template amount */
  amountDrifted: boolean;
}

export interface StatementReport {
  /** step 2 — assign a code to exactly one existing unreconciled donation */
  reconcile: {
    donationId: number;
    archivingCode: string;
    source: MatchSource;
  }[];
  /** step 3 — create a finalized donation from a recurring template */
  recurringImports: RecurringImport[];
  /** step 4 — Montonio/processor payout; donations resolved later via the API */
  cardPayouts: BankTransaction[];
  /** step 5 — donation-like but unresolved; operator handles outside this tool */
  needsDecision: { transaction: BankTransaction; reason: string }[];
  /** step 6 — offer to ignore */
  notADonation: BankTransaction[];
  counts: {
    creditTransactions: number;
    alreadyReconciled: number;
    ignored: number;
  };
}

// ─── Classification helpers ──────────────────────────────────────────────────

const DONATION_SELGITUS =
  /anneta\s*targalt|annetus|p[üu]siannetus|efektiivne\s*altruism/i;

/** Montonio (incl. its Stripe-labelled card settlements) aggregated payout. */
export function looksLikeCardPayout(txn: BankTransaction): boolean {
  const name = txn.counterpartyName.toLowerCase();
  const selg = txn.description.toLowerCase();
  if (name.includes("montonio")) return true;
  if (name === "stripe" && selg.includes("montonio")) return true;
  if (selg.includes("card payout") || selg.includes("payout ")) return true;
  return false;
}

/** Montonio payout UUID embedded in the Selgitus, if present (often truncated). */
export function parsePayoutUuidPrefix(description: string): string | null {
  const m = /payout\s+([0-9a-f-]{8,})/i.exec(description);
  return m ? m[1].toLowerCase() : null;
}

// ─── Recurring import planning (mirror of donation.insertFromTransaction) ─────

/** First template created on/before the transaction date (+24h grace). */
export function selectTemplate(
  templates: RecurringTemplate[],
  transactionDate: string,
): RecurringTemplate | null {
  const limit =
    Date.parse(`${transactionDate.slice(0, 10)}T00:00:00Z`) + 86_400_000;
  return templates.find((t) => Date.parse(t.datetime) <= limit) ?? null;
}

export function planRecurringImport(
  txn: BankTransaction,
  template: RecurringTemplate,
): RecurringImport {
  if (template.orgSplit.length === 0) {
    throw new Error(
      `Recurring template #${template.id} has no organization split`,
    );
  }
  const amountCents = txn.amountCents;
  const multiplier = amountCents / template.amount;

  const resized = resizeOrganizationDonations(
    template.orgSplit,
    multiplier,
    amountCents,
  );

  const datetime = new Date(`${txn.date.slice(0, 10)}T12:00:00`);

  return {
    archivingCode: txn.archivingCode,
    transaction: txn,
    donorId: template.donorId,
    templateId: template.id,
    templateAmountCents: template.amount,
    amountCents,
    datetime: datetime.toISOString(),
    companyName: template.companyName,
    companyCode: template.companyCode,
    paymentMethod: template.bank,
    iban: txn.counterpartyAccount,
    orgDonations: resized.map((o) => ({
      organizationInternalId: o.organizationInternalId,
      amountCents: o.amount,
    })),
    amountDrifted: amountCents !== template.amount,
  };
}

// ─── Categoriser ─────────────────────────────────────────────────────────────

export function categorizeStatement(input: StatementInput): StatementReport {
  const credits = input.transactions.filter(
    (t) => t.direction === "C" && t.archivingCode !== "",
  );

  const report: StatementReport = {
    reconcile: [],
    recurringImports: [],
    cardPayouts: [],
    needsDecision: [],
    notADonation: [],
    counts: {
      creditTransactions: credits.length,
      alreadyReconciled: 0,
      ignored: 0,
    },
  };

  // Step 2: assign codes to existing unreconciled donations — but never a code
  // that is already on a donation or on the ignore list (matchDonations only
  // sees `unreconciledDonations`, so it can still land on an in-window
  // same-amount donation for a code the operator retired last time).
  const match = matchDonations(credits, input.unreconciledDonations);
  const eligible = match.matched.filter(
    (m) =>
      !input.reconciledCodes.has(m.archivingCode) &&
      !input.ignoredCodes.has(m.archivingCode),
  );

  // A single bank line matched to >1 existing donation by amount+date is
  // almost always the wrong month, not a real batch — route those codes to
  // "needs a decision" instead of auto-checking every donation. `selgitus-id`
  // is exempt (it names a specific donation id).
  const byCode = new Map<string, typeof eligible>();
  for (const m of eligible) {
    const arr = byCode.get(m.archivingCode) ?? [];
    arr.push(m);
    byCode.set(m.archivingCode, arr);
  }
  const ambiguousCodes = new Set<string>();
  report.reconcile = [];
  for (const [code, ms] of byCode) {
    if (ms.length === 1 || ms.every((m) => m.source === "selgitus-id")) {
      report.reconcile.push(...ms);
    } else {
      ambiguousCodes.add(code);
    }
  }
  const claimedByReconcile = new Set(
    report.reconcile.map((m) => m.archivingCode),
  );

  for (const txn of credits) {
    const code = txn.archivingCode;

    if (input.ignoredCodes.has(code)) {
      report.counts.ignored++;
      continue;
    }
    if (input.reconciledCodes.has(code)) {
      report.counts.alreadyReconciled++;
      continue;
    }
    if (claimedByReconcile.has(code)) {
      continue; // handled in report.reconcile
    }
    if (ambiguousCodes.has(code)) {
      report.needsDecision.push({
        transaction: txn,
        reason: `matches ${byCode.get(code)?.length ?? 2} existing donations — assign one manually`,
      });
      continue;
    }

    // Step 4: card / processor payout — donations resolved later via Montonio.
    if (looksLikeCardPayout(txn)) {
      report.cardPayouts.push(txn);
      continue;
    }

    // Step 3: recurring import.
    const donor = txn.idOrRegCode
      ? input.donorsByCode.get(txn.idOrRegCode)
      : undefined;
    if (donor) {
      if (donor.templates.length === 0) {
        report.needsDecision.push({
          transaction: txn,
          reason: "known donor, no recurring template",
        });
        continue;
      }
      const template = selectTemplate(donor.templates, txn.date);
      if (!template) {
        report.needsDecision.push({
          transaction: txn,
          reason: "no recurring template predates this payment",
        });
        continue;
      }
      if (template.orgSplit.length === 0) {
        report.needsDecision.push({
          transaction: txn,
          reason: "recurring template has no organization split",
        });
        continue;
      }
      report.recurringImports.push(planRecurringImport(txn, template));
      continue;
    }

    // Step 5 / 6.
    if (DONATION_SELGITUS.test(txn.description)) {
      report.needsDecision.push({
        transaction: txn,
        reason: "donation-like description, unrecognised sender",
      });
    } else {
      report.notADonation.push(txn);
    }
  }

  return report;
}
