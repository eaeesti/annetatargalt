/**
 * Transfer-round management — create a round, attach/detach donations, link the
 * outgoing bank payments, and read back a reconciliation summary
 * (owed to orgs vs actually paid out).
 */
import type { Core } from "@strapi/strapi";
import { db } from "../../../../db/client";
import {
  donationTransfersRepository,
  DonationTransfersRepository,
  DonationsRepository,
  BankTransactionsRepository,
  bankTransactionsRepository,
} from "../../../../db/repositories";

export interface CreateTransferInput {
  datetime: string; // YYYY-MM-DD
  notes?: string | null;
  donationIds: number[];
}

export interface UpdateTransferInput {
  datetime?: string;
  notes?: string | null;
  addDonationIds?: number[];
  removeDonationIds?: number[];
  linkCodes?: string[];
  unlinkCodes?: string[];
}

export function createTransferService(_strapi: Core.Strapi) {
  return {
    /** Finalized, not-yet-assigned donations in a date window. */
    async preview(dateFrom: string, dateTo: string) {
      return donationTransfersRepository.previewDateRange({ dateFrom, dateTo });
    },

    async create(input: CreateTransferInput) {
      return db.transaction(async (tx) => {
        const transfersRepo = new DonationTransfersRepository(tx);
        const donationsRepo = new DonationsRepository(tx);
        const transfer = await transfersRepo.create({
          datetime: input.datetime,
          notes: input.notes ?? null,
          recipient: null,
        });
        if (input.donationIds.length > 0) {
          const r = await donationsRepo.assignToTransfer(
            input.donationIds,
            transfer.id,
          );
          if (!r.ok) {
            throw new Error(
              `Donations ${r.conflicting.join(", ")} can't be added — not finalized, or already on another round`,
            );
          }
        }
        return transfer;
      });
    },

    async update(id: number, input: UpdateTransferInput) {
      return db.transaction(async (tx) => {
        const transfersRepo = new DonationTransfersRepository(tx);
        const donationsRepo = new DonationsRepository(tx);
        const bankRepo = new BankTransactionsRepository(tx);

        const existing = await transfersRepo.findById(id);
        if (!existing)
          return { ok: false as const, reason: "not-found" as const };

        if (input.datetime !== undefined || input.notes !== undefined) {
          await transfersRepo.update(id, {
            ...(input.datetime !== undefined && { datetime: input.datetime }),
            ...(input.notes !== undefined && { notes: input.notes }),
          });
        }
        if (input.removeDonationIds?.length) {
          await donationsRepo.removeFromTransfer(input.removeDonationIds);
        }
        if (input.addDonationIds?.length) {
          const r = await donationsRepo.assignToTransfer(
            input.addDonationIds,
            id,
          );
          if (!r.ok) {
            throw new Error(
              `Donations ${r.conflicting.join(", ")} can't be added — not finalized, or already on another round`,
            );
          }
        }
        if (input.unlinkCodes?.length) {
          const r = await bankRepo.setDonationTransfer(input.unlinkCodes, null);
          if (!r.ok) throw new Error(`Cannot unlink payment (${r.reason})`);
        }
        if (input.linkCodes?.length) {
          const r = await bankRepo.setDonationTransfer(input.linkCodes, id);
          if (!r.ok) {
            throw new Error(
              r.reason === "not-outgoing"
                ? "Only outgoing bank transactions can be linked to a transfer"
                : r.reason === "already-linked"
                  ? "A payment is already linked to another transfer — unlink it there first"
                  : "One or more archiving codes were not found",
            );
          }
        }
        return { ok: true as const };
      });
    },

    async remove(id: number) {
      return donationTransfersRepository.delete(id);
    },

    async getOne(id: number) {
      return donationTransfersRepository.findByIdWithReconciliation(id);
    },

    async unlinkedOutgoing(opts: {
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    }) {
      return bankTransactionsRepository.findUnlinkedOutgoing(opts);
    },
  };
}
