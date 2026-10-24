/**
 * Statement import service — turns an uploaded LHV CSV into a review plan
 * (`preview`) and commits the operator's confirmed decisions (`apply`).
 *
 * Wires the pure categoriser (`utils/statement.ts`) to the DB and enriches the
 * result with donor / organization names for the review UI. `apply` also
 * persists a `bank_transactions` row for every credit line in the statement, so
 * re-uploading the full history idempotently backfills the bank ledger.
 */
import type { Core } from "@strapi/strapi";
import { db } from "../../../../db/client";
import {
  DonationsRepository,
  OrganizationDonationsRepository,
  BankTransactionsRepository,
  SenderDonorAliasesRepository,
  donationsRepository,
  donorsRepository,
  recurringDonationsRepository,
  organizationRecurringDonationsRepository,
  bankTransactionsRepository,
  senderDonorAliasesRepository,
  type BankTransactionUpsert,
} from "../../../../db/repositories";
import {
  parseLhvCsv,
  type BankTransaction,
  type MatchSource,
  type ReconcilableDonation,
} from "../../../../utils/reconciliation";
import { isRecord, oneOf } from "../../../../utils/narrow";
import {
  categorizeStatement,
  parsePayoutUuidPrefix,
  looksLikeCardPayout,
  classifyCreditLine,
  classifyDebitLine,
  computePayoutGrossFee,
  derivePayoutFees,
  selectTemplate,
  planRecurringImport,
  type RecurringTemplate,
  type DonorTemplates,
  type RecurringImport,
  type StatementReport,
} from "../../../../utils/statement";
import { createOrganizationResolver } from "../../../../utils/organization-resolver";
import montonio from "../../../../utils/montonio";

/** Trailing donation id in a Montonio merchant reference (`<prefix> <id>`). */
function refToDonationId(ref: string | undefined): number | null {
  if (!ref) return null;
  const m = /(\d+)\s*$/.exec(ref);
  return m ? Number(m[1]) : null;
}

const toCents = (v: string | number | undefined) =>
  v === undefined || v === null ? NaN : Math.round(Number(v) * 100);

export interface ResolvedCardPayout {
  transaction: BankTransaction;
  /** donation ids the Montonio payout says it covers, still unreconciled */
  resolvedDonationIds: number[];
  /** false when the Montonio lookup failed and manual entry is needed */
  resolved: boolean;
  /** payout total before the processor fee (cents), when resolved */
  grossCents: number | null;
  /** processor fee withheld (cents) = grossCents − bank net, when resolved */
  feeCents: number | null;
}

async function resolveCardPayouts(
  payouts: BankTransaction[],
  unreconciledById: Map<number, ReconcilableDonation>,
): Promise<ResolvedCardPayout[]> {
  const unresolved = (transaction: BankTransaction): ResolvedCardPayout => ({
    transaction,
    resolvedDonationIds: [],
    resolved: false,
    grossCents: null,
    feeCents: null,
  });

  if (payouts.length === 0 || !montonio.isPayoutsConfigured()) {
    return payouts.map(unresolved);
  }

  const list = await montonio.listPayouts();

  return Promise.all(
    payouts.map(async (transaction) => {
      const uuidPrefix = parsePayoutUuidPrefix(transaction.description);
      const payout =
        (uuidPrefix &&
          list.find((p) => p.uuid.toLowerCase().startsWith(uuidPrefix))) ||
        list.find((p) => toCents(p.totalAmount) === transaction.amountCents);

      if (!payout) return unresolved(transaction);

      const orders = await montonio.getPayoutOrders(payout.uuid);
      if (!orders) return unresolved(transaction);

      // every order in the payout: donation id + its gross
      const parsed = orders.map((o) => ({
        donationId: refToDonationId(
          o.merchantReference ?? o.merchant_reference,
        ),
        grossCents: toCents(
          o.grandTotal ?? o.grand_total ?? o.amount ?? o.total,
        ),
      }));
      const orderRows = parsed.filter(
        (o): o is { donationId: number; grossCents: number } =>
          o.donationId !== null && Number.isFinite(o.grossCents),
      );

      const { grossCents, feeCents } = computePayoutGrossFee(
        parsed,
        transaction.amountCents,
      );

      const resolvedDonationIds = [
        ...new Set(
          orderRows
            .map((o) => o.donationId)
            .filter((id) => unreconciledById.has(id)),
        ),
      ];

      return {
        transaction,
        resolvedDonationIds,
        resolved: true,
        grossCents,
        feeCents,
      };
    }),
  );
}

export interface ApplyPayload {
  reconcile: {
    donationId: number;
    archivingCode: string;
    source: MatchSource;
  }[];
  /** a preview's recurring import: apply plans it again from the database */
  recurringImports: {
    transaction: BankTransaction;
    donorId: number;
    templateId?: number;
  }[];
  /** operator pointed a "needs a decision" line at a donor → create from template */
  manualRecurring: { transaction: BankTransaction; donorId: number }[];
  /** persist "this sender code is this donor" so future imports auto-resolve */
  rememberSenders: {
    senderCode: string;
    donorId: number;
    note?: string | null;
  }[];
  cardPayoutAssignments: { donationId: number; archivingCode: string }[];
  /** per card-payout code: totals echoed from preview (or a manual fee) */
  cardPayouts: {
    archivingCode: string;
    grossCents: number | null;
    feeCents: number | null;
  }[];
  ignore: { archivingCode: string; reason?: string | null }[];
  /** every credit line in the statement — persisted as bank_transactions rows */
  allCredits: BankTransaction[];
  /** every debit line — persisted as `outgoing` bank_transactions rows */
  allDebits: BankTransaction[];
}

// ── reading the apply request ───────────────────────────────────────────────
// Apply trusts nothing the browser sends back from the preview: each part is
// checked here, and a malformed one throws, which the controller answers with
// a 400 that says what was wrong.

const CODE_RE = /^[A-Za-z0-9_-]{1,20}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const MATCH_SOURCES: readonly MatchSource[] = [
  "selgitus-id",
  "idcode-amount-date",
  "manual",
  "recurring-import",
  "card-payout",
];

const text = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * A statement line as the browser echoes it back. Apply trusts the client
 * for the bank-row metadata (date/amount/…) but not for which codes belong
 * to the statement, and every string field is coerced so downstream code
 * (looksLikeCardPayout, .slice) can't throw.
 */
function parseLine(t: unknown): BankTransaction {
  const r: Record<string, unknown> = isRecord(t) ? t : {};
  const code = text(r.archivingCode);
  if (!CODE_RE.test(code)) {
    throw new Error(
      `Malformed statement line: bad archiving code ${JSON.stringify(r.archivingCode)}`,
    );
  }
  const amountCents = r.amountCents;
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) {
    throw new Error(
      `Malformed statement line ${code}: non-numeric amount — re-analyse the statement and try again`,
    );
  }
  const date = text(r.date);
  if (date !== "" && !ISO_DATE_RE.test(date)) {
    throw new Error(`Malformed statement line ${code}: bad date`);
  }
  return {
    archivingCode: code,
    entryReference: text(r.entryReference),
    amountCents,
    date: date.slice(0, 10),
    description: text(r.description),
    counterpartyName: text(r.counterpartyName),
    counterpartyAccount: text(r.counterpartyAccount),
    idOrRegCode: text(r.idOrRegCode),
    direction: r.direction === "D" ? "D" : "C",
  };
}

/** The objects in the request's list `key`; none if it's left out. */
function items(
  body: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const value = body[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Malformed request: ${key} must be a list of objects`);
  }
  return value;
}

/** A whole number the request must give, like a donation id. */
function wholeNumber(
  item: Record<string, unknown>,
  key: string,
  list: string,
): number {
  const value = item[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(
      `Malformed request: each of ${list} needs a whole-number ${key}`,
    );
  }
  return value;
}

const numberOrNull = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** The apply request, checked. */
export function parseApplyPayload(raw: unknown): ApplyPayload {
  const body: Record<string, unknown> = isRecord(raw) ? raw : {};
  const lines = (key: string) => {
    const value = body[key];
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      throw new Error(`Malformed request: ${key} must be a list`);
    }
    return value.map(parseLine);
  };
  return {
    reconcile: items(body, "reconcile").map((r) => ({
      donationId: wholeNumber(r, "donationId", "reconcile"),
      archivingCode: text(r.archivingCode),
      source: oneOf(r.source, MATCH_SOURCES) ?? "manual",
    })),
    recurringImports: items(body, "recurringImports").map((i) => ({
      transaction: parseLine(i.transaction),
      donorId: wholeNumber(i, "donorId", "recurringImports"),
      templateId: typeof i.templateId === "number" ? i.templateId : undefined,
    })),
    manualRecurring: items(body, "manualRecurring").map((m) => ({
      transaction: parseLine(m.transaction),
      donorId: wholeNumber(m, "donorId", "manualRecurring"),
    })),
    // one that can't be remembered is left out, not an error
    rememberSenders: items(body, "rememberSenders").flatMap((s) =>
      typeof s.senderCode === "string" &&
      s.senderCode !== "" &&
      typeof s.donorId === "number" &&
      Number.isInteger(s.donorId)
        ? [
            {
              senderCode: s.senderCode,
              donorId: s.donorId,
              note: typeof s.note === "string" ? s.note : null,
            },
          ]
        : [],
    ),
    cardPayoutAssignments: items(body, "cardPayoutAssignments").map((a) => ({
      donationId: wholeNumber(a, "donationId", "cardPayoutAssignments"),
      archivingCode: text(a.archivingCode),
    })),
    cardPayouts: items(body, "cardPayouts").map((c) => ({
      archivingCode: text(c.archivingCode),
      grossCents: numberOrNull(c.grossCents),
      feeCents: numberOrNull(c.feeCents),
    })),
    ignore: items(body, "ignore").map((i) => ({
      archivingCode: text(i.archivingCode),
      reason: typeof i.reason === "string" ? i.reason : null,
    })),
    allCredits: lines("allCredits"),
    allDebits: lines("allDebits"),
  };
}

interface DonorTemplateIndex {
  /** idCode / company code / learned alias → donor + templates */
  byCode: Map<string, DonorTemplates>;
  /** donor id → templates, newest first */
  byDonor: Map<number, RecurringTemplate[]>;
  /** donor id → display name */
  donorName: Map<number, string>;
}

async function loadDonorTemplates(): Promise<DonorTemplateIndex> {
  const [donors, templates, orgSplits, aliases] = await Promise.all([
    donorsRepository.findAll(),
    recurringDonationsRepository.findAll(),
    organizationRecurringDonationsRepository.findAll(),
    senderDonorAliasesRepository.map(),
  ]);

  const splitByTemplate = new Map<
    number,
    { organizationInternalId: string; amount: number }[]
  >();
  for (const s of orgSplits) {
    const arr = splitByTemplate.get(s.recurringDonationId) ?? [];
    arr.push({
      organizationInternalId: s.organizationInternalId ?? "",
      amount: s.amount,
    });
    splitByTemplate.set(s.recurringDonationId, arr);
  }

  const byDonor = new Map<number, RecurringTemplate[]>();
  for (const t of templates) {
    const arr = byDonor.get(t.donorId) ?? [];
    arr.push({
      id: t.id,
      donorId: t.donorId,
      datetime: new Date(t.datetime).toISOString(),
      amount: t.amount,
      companyName: t.companyName,
      companyCode: t.companyCode,
      bank: t.bank,
      orgSplit: splitByTemplate.get(t.id) ?? [],
    });
    byDonor.set(t.donorId, arr);
  }
  for (const arr of byDonor.values()) {
    arr.sort((a, b) => Date.parse(b.datetime) - Date.parse(a.datetime));
  }

  const donorById = new Map(donors.map((d) => [d.id, d]));
  const donorName = new Map(
    donors.map((d) => [
      d.id,
      [d.firstName, d.lastName].filter(Boolean).join(" ") || `#${d.id}`,
    ]),
  );
  const byCode = new Map<string, DonorTemplates>();
  for (const [donorId, tmpls] of byDonor) {
    const donor = donorById.get(donorId);
    if (donor?.idCode) byCode.set(donor.idCode, { donorId, templates: tmpls });
    for (const t of tmpls) {
      if (t.companyCode)
        byCode.set(t.companyCode, { donorId, templates: tmpls });
    }
  }
  // learned aliases (foreign codes etc.) — only useful if that donor has a template
  for (const [senderCode, donorId] of aliases) {
    const tmpls = byDonor.get(donorId);
    if (tmpls && tmpls.length > 0)
      byCode.set(senderCode, { donorId, templates: tmpls });
  }
  return { byCode, byDonor, donorName };
}

/**
 * Re-derive a recurring-import plan from trusted DB state — the template id the
 * client asked for if it's still that donor's, else the one that predates the
 * payment. Throws (aborting the apply) if there's no usable template.
 */
function planFromTemplateIndex(
  index: DonorTemplateIndex,
  transaction: BankTransaction,
  donorId: number,
  preferredTemplateId?: number,
): RecurringImport {
  const templates = index.byDonor.get(donorId) ?? [];
  const dated = selectTemplate(templates, transaction.date);
  // honour the client's template choice only if it's this donor's AND it also
  // predates the payment; otherwise fall back to the date-selected one
  const preferred =
    preferredTemplateId !== undefined
      ? templates.find(
          (t) =>
            t.id === preferredTemplateId &&
            dated !== null &&
            Date.parse(t.datetime) <= Date.parse(dated.datetime) + 1,
        )
      : undefined;
  const template = preferred ?? dated;
  if (!template) {
    throw new Error(
      `Donor #${donorId} has no recurring template dated on/before ${transaction.date.slice(0, 10)}`,
    );
  }
  return planRecurringImport(transaction, template);
}

export function createStatementService(strapi: Core.Strapi) {
  const orgResolver = createOrganizationResolver(strapi);

  async function orgNames(ids: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    const out: Record<string, string> = {};
    await Promise.all(
      unique.map(async (id) => {
        const org = await orgResolver.findByInternalId(id);
        out[id] = org?.title ?? id;
      }),
    );
    return out;
  }

  return {
    async preview(csv: Buffer | string) {
      const transactions = parseLhvCsv(csv);

      const [
        unreconciledDonations,
        reconciledCodes,
        ignoredCodes,
        recordedCodes,
        unimportedCodes,
        undirectedCodes,
        index,
      ] = await Promise.all([
        donationsRepository.findForReconciliation({ onlyUnreconciled: true }),
        donationsRepository.reconciledTransactionIds(),
        bankTransactionsRepository.ignoredCodes(),
        bankTransactionsRepository.recordedCodes(),
        bankTransactionsRepository.unimportedCodes(),
        bankTransactionsRepository.undirectedCodes(),
        loadDonorTemplates(),
      ]);

      const report: StatementReport = categorizeStatement({
        transactions,
        unreconciledDonations,
        reconciledCodes,
        ignoredCodes,
        recordedCodes,
        unimportedCodes,
        undirectedCodes,
        donorsByCode: index.byCode,
      });

      // ── enrichment for the review UI (no extra queries) ───────────────────
      const donationById = new Map(unreconciledDonations.map((d) => [d.id, d]));

      const donorNames: Record<number, string> = {};
      for (const i of report.recurringImports) {
        donorNames[i.donorId] =
          index.donorName.get(i.donorId) ?? `#${i.donorId}`;
      }

      const reconcileDetail = report.reconcile.map((r) => {
        const d = donationById.get(r.donationId);
        return {
          ...r,
          amountCents: d?.amountCents ?? null,
          datetime: d?.datetime ?? null,
          donorName: d?.donorName ?? null,
        };
      });

      const names = await orgNames(
        report.recurringImports.flatMap((i) =>
          i.orgDonations.map((o) => o.organizationInternalId),
        ),
      );

      const cardPayouts = await resolveCardPayouts(
        report.cardPayouts,
        donationById,
      );

      return {
        counts: report.counts,
        reconcile: reconcileDetail,
        recurringImports: report.recurringImports,
        cardPayouts,
        needsDecision: report.needsDecision,
        notADonation: report.notADonation,
        alreadyIgnored: report.alreadyIgnored,
        notImported: report.notImported,
        allCredits: report.allCredits,
        allDebits: report.allDebits,
        donorNames,
        orgNames: names,
      };
    },

    async apply(request: unknown, userEmail: string) {
      const payload = parseApplyPayload(request);
      const summary = {
        reconciled: 0,
        created: 0,
        ignored: 0,
        recorded: 0,
        directionsFilled: 0,
        payoutFeesDerived: 0,
      };

      const creditLines = payload.allCredits;
      const debitLines = payload.allDebits;
      const statementCodes = new Set(
        [...creditLines, ...debitLines].map((t) => t.archivingCode),
      );
      const actionCodes = [
        ...(payload.reconcile ?? []).map((r) => r.archivingCode),
        ...(payload.cardPayoutAssignments ?? []).map((a) => a.archivingCode),
        ...(payload.ignore ?? []).map((i) => i.archivingCode),
        ...payload.recurringImports.map((i) => i.transaction.archivingCode),
        ...payload.manualRecurring.map((m) => m.transaction.archivingCode),
      ];
      for (const code of actionCodes) {
        if (!code || !statementCodes.has(code)) {
          throw new Error(
            `Code ${code || "(missing)"} is not a line in the uploaded statement — re-analyse and try again`,
          );
        }
      }

      // Re-derive every recurring-import plan from current DB state — never
      // trust the amounts / org splits the client sent back. Reads only, up
      // front, so the write transaction stays tight.
      const index = await loadDonorTemplates();
      const allImports: RecurringImport[] = [
        ...(payload.recurringImports ?? []).map((imp) =>
          planFromTemplateIndex(
            index,
            imp.transaction,
            imp.donorId,
            imp.templateId,
          ),
        ),
        ...(payload.manualRecurring ?? []).map((mr) =>
          planFromTemplateIndex(index, mr.transaction, mr.donorId),
        ),
      ];

      // ── classify every line for the bank_transactions upsert ─────────────
      // codes with hard evidence of being a donation: an explicit reconcile /
      // recurring-import this run, OR a donation already points at the code.
      const reconciledCodes =
        await donationsRepository.reconciledTransactionIds();
      const explicitDonationCodes = new Set<string>();
      for (const r of payload.reconcile ?? [])
        explicitDonationCodes.add(r.archivingCode);
      for (const imp of allImports)
        explicitDonationCodes.add(imp.archivingCode);
      const cardAssignCodes = new Set(
        (payload.cardPayoutAssignments ?? []).map((a) => a.archivingCode),
      );

      const ignoreByCode = new Map(
        (payload.ignore ?? []).map((i) => [i.archivingCode, i.reason ?? null]),
      );
      // never let an operator ignore a code that has a donation on it — that
      // would drop the donation's money from the money-flow summary silently
      for (const code of ignoreByCode.keys()) {
        if (reconciledCodes.has(code)) {
          throw new Error(
            `Code ${code} has a donation linked to it — reassign or delete the donation before ignoring the line`,
          );
        }
      }
      const cardPayoutByCode = new Map(
        (payload.cardPayouts ?? []).map((c) => [c.archivingCode, c]),
      );

      const existingCategories = await bankTransactionsRepository.categoriesFor(
        [...creditLines, ...debitLines].map((t) => t.archivingCode),
      );
      const undirectedCodes =
        await bankTransactionsRepository.undirectedCodes();

      /** reject a negative fee or one implausibly large vs the net credited */
      const clampFee = (
        v: number | null | undefined,
        netCents: number,
      ): number | null => {
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
        const cents = Math.round(v);
        return cents > netCents * 0.2 ? null : cents;
      };

      const bankRows: BankTransactionUpsert[] = creditLines.map((txn) => {
        const code = txn.archivingCode;
        const { category, reclassify } = classifyCreditLine({
          isCardPayout: looksLikeCardPayout(txn),
          ignoredNow: ignoreByCode.has(code),
          explicitDonation: explicitDonationCodes.has(code),
          cardAssignedNow: cardAssignCodes.has(code),
          alreadyLinked: reconciledCodes.has(code),
          existingCategory: existingCategories.get(code),
        });

        const cp = cardPayoutByCode.get(code);
        const feeAmountCents =
          category === "card-payout"
            ? clampFee(cp?.feeCents, txn.amountCents)
            : null;
        const grossAmountCents =
          category === "card-payout"
            ? (cp?.grossCents ??
              (feeAmountCents !== null
                ? txn.amountCents + feeAmountCents
                : null))
            : null;

        return {
          archivingCode: code,
          date: txn.date || null,
          amountCents: txn.amountCents,
          direction: "C",
          description: txn.description || null,
          counterpartyName: txn.counterpartyName || null,
          counterpartyAccount: txn.counterpartyAccount || null,
          senderCode: txn.idOrRegCode || null,
          category,
          reclassify,
          note: category === "ignored" ? ignoreByCode.get(code) : null,
          importedBy: userEmail,
          grossAmountCents,
          feeAmountCents,
        };
      });

      // debit lines — `outgoing` when new (amount stored positive)
      for (const txn of debitLines) {
        bankRows.push({
          archivingCode: txn.archivingCode,
          date: txn.date || null,
          amountCents: Math.abs(txn.amountCents),
          direction: "D",
          description: txn.description || null,
          counterpartyName: txn.counterpartyName || null,
          counterpartyAccount: txn.counterpartyAccount || null,
          senderCode: txn.idOrRegCode || null,
          category: classifyDebitLine(
            existingCategories.get(txn.archivingCode),
          ),
          note: null,
          importedBy: userEmail,
        });
      }

      // the fee we actually persisted per card-payout code (already clamped)
      const persistedFeeByCode = new Map(
        bankRows
          .filter((r) => r.category === "card-payout")
          .map((r) => [r.archivingCode, r.feeAmountCents ?? null]),
      );
      const persistedGrossByCode = new Map(
        bankRows
          .filter((r) => r.category === "card-payout")
          .map((r) => [r.archivingCode, r.grossAmountCents ?? null]),
      );

      // per-donation card-payout fee, computed server-side. Each assigned
      // donation gets its own slice of the payout fee, pro-rata against the
      // whole payout's gross — NOT against just the donations being assigned
      // now. A payout that also covers donations reconciled in an earlier run
      // must not have its entire fee dumped onto the remaining subset.
      const assignmentsByCode = new Map<string, number[]>();
      for (const a of payload.cardPayoutAssignments ?? []) {
        const arr = assignmentsByCode.get(a.archivingCode) ?? [];
        arr.push(a.donationId);
        assignmentsByCode.set(a.archivingCode, arr);
      }
      const donationFee = new Map<number, number>();
      if (assignmentsByCode.size > 0) {
        const grossById = new Map(
          (await donationsRepository.findForReconciliation()).map((d) => [
            d.id,
            d.amountCents,
          ]),
        );
        for (const [code, donationIds] of assignmentsByCode) {
          const feeCents = persistedFeeByCode.get(code);
          if (!feeCents) continue;
          const payoutGross = persistedGrossByCode.get(code);
          const grossByThisDonation = donationIds.map(
            (id) => grossById.get(id) ?? 0,
          );
          // denominator: the whole payout's gross when known (Montonio
          // resolved), else fall back to the assigned donations' gross (manual
          // fee entry — the operator's number covers what they're assigning).
          const denom =
            payoutGross && payoutGross > 0
              ? payoutGross
              : grossByThisDonation.reduce((s, g) => s + g, 0);
          if (denom <= 0) continue;
          donationIds.forEach((id, i) => {
            donationFee.set(
              id,
              Math.round((feeCents * grossByThisDonation[i]) / denom),
            );
          });
        }
      }

      await db.transaction(async (tx) => {
        const donationsRepo = new DonationsRepository(tx);
        const orgDonationsRepo = new OrganizationDonationsRepository(tx);
        const bankRepo = new BankTransactionsRepository(tx);
        const aliasRepo = new SenderDonorAliasesRepository(tx);

        // FIRST — the FK on donations.transaction_id needs these rows to exist
        summary.recorded = await bankRepo.upsertMany(bankRows);
        summary.directionsFilled = [...statementCodes].filter((code) =>
          undirectedCodes.has(code),
        ).length;

        for (const imp of allImports) {
          const donation = await donationsRepo.create({
            donorId: imp.donorId,
            recurringDonationId: imp.templateId,
            amount: imp.amountCents,
            datetime: new Date(imp.datetime),
            finalized: true,
            companyName: imp.companyName,
            companyCode: imp.companyCode,
            iban: imp.iban,
            paymentMethod: imp.paymentMethod,
            transactionId: imp.archivingCode,
            transactionMatchSource: "recurring-import",
          });
          await orgDonationsRepo.createMany(
            imp.orgDonations.map((o) => ({
              donationId: donation.id,
              organizationInternalId: o.organizationInternalId,
              amount: o.amountCents,
            })),
          );
          summary.created++;
        }

        for (const r of payload.reconcile ?? []) {
          const ok = await donationsRepo.setTransactionId(
            r.donationId,
            r.archivingCode,
            r.source,
          );
          if (!ok) throw new Error(`Donation #${r.donationId} not found`);
          summary.reconciled++;
        }
        for (const a of payload.cardPayoutAssignments ?? []) {
          const ok = await donationsRepo.setTransactionId(
            a.donationId,
            a.archivingCode,
            "card-payout",
          );
          if (!ok) throw new Error(`Donation #${a.donationId} not found`);
          const fee = donationFee.get(a.donationId);
          if (fee !== undefined)
            await donationsRepo.setProcessorFee(a.donationId, fee);
          summary.reconciled++;
        }

        summary.ignored = ignoreByCode.size;

        // A card payout Montonio couldn't price, here or in an earlier import,
        // gets its gross and fee from the donations now linked to it.
        for (const row of await bankRepo.cardPayoutsMissingFee()) {
          const detail = await bankRepo.findByCodeWithDonations(
            row.archivingCode,
          );
          const derived = derivePayoutFees(
            row.amount ?? 0,
            (detail?.donations ?? []).map((d) => ({
              id: d.id,
              amountCents: d.amount,
              finalized: d.finalized,
            })),
          );
          if (!derived) continue;
          await bankRepo.recordPayoutTotals(
            row.archivingCode,
            derived.grossCents,
            derived.feeCents,
          );
          for (const d of derived.feeByDonation) {
            await donationsRepo.setProcessorFee(d.id, d.feeCents);
          }
          summary.payoutFeesDerived++;
        }

        await aliasRepo.add(
          payload.rememberSenders.map((s) => ({
            senderCode: s.senderCode,
            donorId: s.donorId,
            note: s.note ?? null,
            createdBy: userEmail,
          })),
        );
      });

      return summary;
    },
  };
}
