/**
 * Statement import service — turns an uploaded LHV CSV into a review plan
 * (`preview`) and commits the operator's confirmed decisions (`apply`).
 *
 * Wires the pure categoriser (`utils/statement.ts`) to the DB and enriches the
 * result with donor / organization names for the review UI.
 */
import type { Core } from "@strapi/strapi";
import { db } from "../../../../db/client";
import {
  DonationsRepository,
  OrganizationDonationsRepository,
  IgnoredBankTransactionsRepository,
  SenderDonorAliasesRepository,
  donationsRepository,
  donorsRepository,
  recurringDonationsRepository,
  organizationRecurringDonationsRepository,
  ignoredBankTransactionsRepository,
  senderDonorAliasesRepository,
} from "../../../../db/repositories";
import {
  parseLhvCsv,
  type BankTransaction,
} from "../../../../utils/reconciliation";
import {
  categorizeStatement,
  parsePayoutUuidPrefix,
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

export interface ResolvedCardPayout {
  transaction: BankTransaction;
  /** donation ids the Montonio payout says it covers, still unreconciled */
  resolvedDonationIds: number[];
  /** false when the Montonio lookup failed and manual entry is needed */
  resolved: boolean;
}

async function resolveCardPayouts(
  payouts: BankTransaction[],
  unreconciledIds: Set<number>,
): Promise<ResolvedCardPayout[]> {
  if (payouts.length === 0 || !montonio.isPayoutsConfigured()) {
    return payouts.map((transaction) => ({
      transaction,
      resolvedDonationIds: [],
      resolved: false,
    }));
  }

  const list = await montonio.listPayouts(100);

  const toCents = (v: string | number | undefined) =>
    v === undefined ? NaN : Math.round(Number(v) * 100);

  return Promise.all(
    payouts.map(async (transaction) => {
      const uuidPrefix = parsePayoutUuidPrefix(transaction.description);
      const payout =
        (uuidPrefix &&
          list.find((p) => p.uuid.toLowerCase().startsWith(uuidPrefix))) ||
        list.find((p) => toCents(p.amount) === transaction.amountCents);

      if (!payout) {
        return { transaction, resolvedDonationIds: [], resolved: false };
      }

      const orders = await montonio.getPayoutOrders(payout.uuid);
      if (!orders) {
        return { transaction, resolvedDonationIds: [], resolved: false };
      }

      const ids = orders
        .map((o) =>
          refToDonationId(o.merchantReference ?? o.merchant_reference),
        )
        .filter((id): id is number => id !== null && unreconciledIds.has(id));

      return {
        transaction,
        resolvedDonationIds: [...new Set(ids)],
        resolved: true,
      };
    }),
  );
}

export interface ApplyPayload {
  reconcile: { donationId: number; archivingCode: string; source: string }[];
  recurringImports: RecurringImport[];
  /** operator pointed a "needs a decision" line at a donor → create from template */
  manualRecurring: { transaction: BankTransaction; donorId: number }[];
  /** persist "this sender code is this donor" so future imports auto-resolve */
  rememberSenders: {
    senderCode: string;
    donorId: number;
    note?: string | null;
  }[];
  cardPayoutAssignments: { donationId: number; archivingCode: string }[];
  ignore: { archivingCode: string; reason?: string | null }[];
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
    preferredTemplateId != null
      ? templates.find(
          (t) =>
            t.id === preferredTemplateId &&
            dated != null &&
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
        out[id] =
          (org as { title?: string; name?: string } | null)?.title ??
          (org as { name?: string } | null)?.name ??
          id;
      }),
    );
    return out;
  }

  return {
    async preview(csv: Buffer | string) {
      const transactions = parseLhvCsv(csv);

      const [unreconciledDonations, reconciledCodes, ignoredCodes, index] =
        await Promise.all([
          donationsRepository.findForReconciliation({ onlyUnreconciled: true }),
          donationsRepository.reconciledTransactionIds(),
          ignoredBankTransactionsRepository.codes(),
          loadDonorTemplates(),
        ]);

      const report: StatementReport = categorizeStatement({
        transactions,
        unreconciledDonations,
        reconciledCodes,
        ignoredCodes,
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
        new Set(unreconciledDonations.map((d) => d.id)),
      );

      return {
        counts: report.counts,
        reconcile: reconcileDetail,
        recurringImports: report.recurringImports,
        cardPayouts,
        needsDecision: report.needsDecision,
        notADonation: report.notADonation,
        donorNames,
        orgNames: names,
      };
    },

    async apply(payload: ApplyPayload, userEmail: string) {
      const summary = { reconciled: 0, created: 0, ignored: 0 };

      // Re-derive every recurring-import plan from current DB state — never
      // trust the amounts / org splits the client sent back (the template or
      // its split may have changed since preview). Done up front (reads only)
      // so the write transaction stays tight.
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

      await db.transaction(async (tx) => {
        const donationsRepo = new DonationsRepository(tx);
        const orgDonationsRepo = new OrganizationDonationsRepository(tx);
        const ignoredRepo = new IgnoredBankTransactionsRepository(tx);
        const aliasRepo = new SenderDonorAliasesRepository(tx);

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

        for (const r of payload.reconcile) {
          const ok = await donationsRepo.setTransactionId(
            r.donationId,
            r.archivingCode,
            (r.source as never) || "manual",
          );
          if (!ok) throw new Error(`Donation #${r.donationId} not found`);
          summary.reconciled++;
        }
        for (const a of payload.cardPayoutAssignments) {
          const ok = await donationsRepo.setTransactionId(
            a.donationId,
            a.archivingCode,
            "card-payout",
          );
          if (!ok) throw new Error(`Donation #${a.donationId} not found`);
          summary.reconciled++;
        }

        await ignoredRepo.add(
          payload.ignore.map((i) => ({
            archivingCode: i.archivingCode,
            reason: i.reason ?? null,
            createdBy: userEmail,
          })),
        );
        summary.ignored = payload.ignore.length;

        await aliasRepo.add(
          (payload.rememberSenders ?? [])
            .filter((s) => s.senderCode && Number.isInteger(s.donorId))
            .map((s) => ({
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
