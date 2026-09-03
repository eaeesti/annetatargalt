/**
 * Bank-transactions ledger service — read views over `bank_transactions`
 * (list, one-with-donations, money-flow summary) plus the single write path
 * (reclassify a code's category/note).
 */
import type { Core } from "@strapi/strapi";
import {
  bankTransactionsRepository,
  type BankTransactionCategory,
} from "../../../../db/repositories";
import { createOrganizationResolver } from "../../../../utils/organization-resolver";

const CATEGORIES: BankTransactionCategory[] = [
  "donation",
  "card-payout",
  "ignored",
  "undecided",
];

export function createBankTransactionService(strapi: Core.Strapi) {
  const orgResolver = createOrganizationResolver(strapi);

  return {
    async list(opts: {
      page: number;
      pageSize: number;
      sortBy?: string;
      sortDir?: "asc" | "desc";
      category?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    }) {
      const category =
        opts.category && CATEGORIES.includes(opts.category as never)
          ? opts.category
          : undefined;
      return bankTransactionsRepository.findPaginated({ ...opts, category });
    },

    async summary(opts: { dateFrom?: string | null; dateTo?: string | null }) {
      return bankTransactionsRepository.moneyFlow(opts);
    },

    async findOne(code: string) {
      const row =
        await bankTransactionsRepository.findByCodeWithDonations(code);
      if (!row) return null;

      const orgIds = new Set<string>();
      for (const d of row.donations ?? [])
        for (const od of d.organizationDonations ?? [])
          orgIds.add(od.organizationInternalId);

      const orgNames: Record<string, string> = {};
      await Promise.all(
        [...orgIds].map(async (id) => {
          const org = await orgResolver.findByInternalId(id);
          orgNames[id] =
            (org as { title?: string; name?: string } | null)?.title ??
            (org as { name?: string } | null)?.name ??
            id;
        }),
      );

      const donations = (row.donations ?? []).map((d) => ({
        id: d.id,
        datetime: d.datetime,
        amount: d.amount,
        finalized: d.finalized,
        processorFeeCents: d.processorFeeCents,
        transactionMatchSource: d.transactionMatchSource,
        donationTransferId: d.donationTransferId,
        donorName: d.donor
          ? [d.donor.firstName, d.donor.lastName].filter(Boolean).join(" ") ||
            `#${d.donor.id}`
          : null,
        orgDonations: (d.organizationDonations ?? []).map((od) => ({
          organizationInternalId: od.organizationInternalId,
          organizationName:
            orgNames[od.organizationInternalId] ?? od.organizationInternalId,
          amount: od.amount,
        })),
      }));

      const { donations: _omit, ...bank } = row;
      return { ...bank, donations };
    },

    async reclassify(
      code: string,
      category: string,
      note: string | null,
      by: string | null,
    ) {
      if (!CATEGORIES.includes(category as never)) {
        return { ok: false as const, reason: "bad-category" as const };
      }
      return bankTransactionsRepository.setCategory(
        code,
        category as BankTransactionCategory,
        note,
        by,
      );
    },
  };
}
