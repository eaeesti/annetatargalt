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
  donationsRepository,
  donorsRepository,
  recurringDonationsRepository,
  organizationRecurringDonationsRepository,
  ignoredBankTransactionsRepository,
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

  return Promise.all(
    payouts.map(async (transaction) => {
      const uuidPrefix = parsePayoutUuidPrefix(transaction.description);
      const major = (transaction.amountCents / 100).toFixed(2);
      const payout =
        (uuidPrefix &&
          list.find((p) => p.uuid.toLowerCase().startsWith(uuidPrefix))) ||
        list.find((p) => String(p.amount) === major);

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
  cardPayoutAssignments: { donationId: number; archivingCode: string }[];
  ignore: { archivingCode: string; reason?: string | null }[];
}

async function loadDonorsByCode(): Promise<Map<string, DonorTemplates>> {
  const [donors, templates, orgSplits] = await Promise.all([
    donorsRepository.findAll(),
    recurringDonationsRepository.findAll(),
    organizationRecurringDonationsRepository.findAll(),
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
  const byCode = new Map<string, DonorTemplates>();
  for (const [donorId, tmpls] of byDonor) {
    const donor = donorById.get(donorId);
    if (donor?.idCode) byCode.set(donor.idCode, { donorId, templates: tmpls });
    for (const t of tmpls) {
      if (t.companyCode)
        byCode.set(t.companyCode, { donorId, templates: tmpls });
    }
  }
  return byCode;
}

/** Templates + org splits for one donor, newest first. */
async function loadTemplatesForDonor(
  donorId: number,
): Promise<RecurringTemplate[]> {
  const templates = await recurringDonationsRepository.findByDonorId(donorId);
  return Promise.all(
    templates.map(async (t) => ({
      id: t.id,
      donorId: t.donorId,
      datetime: new Date(t.datetime).toISOString(),
      amount: t.amount,
      companyName: t.companyName,
      companyCode: t.companyCode,
      bank: t.bank,
      orgSplit: (
        await organizationRecurringDonationsRepository.findByRecurringDonationId(
          t.id,
        )
      ).map((o) => ({
        organizationInternalId: o.organizationInternalId ?? "",
        amount: o.amount,
      })),
    })),
  );
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

      const [
        unreconciledDonations,
        reconciledCodes,
        ignoredCodes,
        donorsByCode,
      ] = await Promise.all([
        donationsRepository.findForReconciliation({ onlyUnreconciled: true }),
        donationsRepository.reconciledTransactionIds(),
        ignoredBankTransactionsRepository.codes(),
        loadDonorsByCode(),
      ]);

      const report: StatementReport = categorizeStatement({
        transactions,
        unreconciledDonations,
        reconciledCodes,
        ignoredCodes,
        donorsByCode,
      });

      // ── enrichment for the review UI ──────────────────────────────────────
      const donorIds = new Set<number>();
      for (const i of report.recurringImports) donorIds.add(i.donorId);

      const donationIds = report.reconcile.map((r) => r.donationId);
      const [donations, donors] = await Promise.all([
        Promise.all(
          donationIds.map((id) =>
            donationsRepository.findByIdWithRelations(id),
          ),
        ),
        Promise.all([...donorIds].map((id) => donorsRepository.findById(id))),
      ]);

      const donorNames: Record<number, string> = {};
      for (const d of donors) {
        if (!d) continue;
        donorNames[d.id] = [d.firstName, d.lastName].filter(Boolean).join(" ");
      }

      const reconcileDetail = report.reconcile.map((r, idx) => {
        const d = donations[idx];
        return {
          ...r,
          amountCents: d?.amount ?? null,
          datetime: d?.datetime ?? null,
          donorName: d?.donor
            ? [d.donor.firstName, d.donor.lastName].filter(Boolean).join(" ")
            : null,
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

      // Resolve "needs a decision → this donor" into full plans up front
      // (reads only), so the write transaction stays tight.
      const manualPlans: RecurringImport[] = [];
      for (const mr of payload.manualRecurring ?? []) {
        const templates = await loadTemplatesForDonor(mr.donorId);
        const template = selectTemplate(templates, mr.transaction.date);
        if (!template) {
          throw new Error(
            `Donor #${mr.donorId} has no recurring template dated on/before ${mr.transaction.date}`,
          );
        }
        manualPlans.push(planRecurringImport(mr.transaction, template));
      }
      const allImports = [...payload.recurringImports, ...manualPlans];

      await db.transaction(async (tx) => {
        const donationsRepo = new DonationsRepository(tx);
        const orgDonationsRepo = new OrganizationDonationsRepository(tx);
        const ignoredRepo = new IgnoredBankTransactionsRepository(tx);

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
      });

      return summary;
    },
  };
}
