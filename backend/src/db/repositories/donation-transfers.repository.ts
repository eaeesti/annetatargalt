import { eq, desc, asc, sql, count, and, gte, lte, isNull } from "drizzle-orm";
import { db, type Database } from "../client";
import {
  donationTransfers,
  donations,
  organizationDonations,
  bankTransactions,
  type DonationTransfer,
  type NewDonationTransfer,
} from "../schema";
import { BankTransactionFilesRepository } from "./bank-transaction-files.repository";

/**
 * How far `paid out` may drift from `owed` before a transfer round is flagged:
 * the larger of €10 or 0.5% of the owed total. Card-fee absorption and the
 * outgoing SEPA fee make a little slack normal; a bigger gap means a payment is
 * missing or on the wrong round.
 */
export function transferBalanceToleranceCents(owedCents: number): number {
  return Math.max(1000, Math.round(Math.abs(owedCents) * 0.005));
}

/**
 * A round is reconciled when `owed − paidOut − adjustment` is within tolerance.
 * `null` when there is nothing to assess yet (no linked payment and no
 * operator adjustment).
 *
 * This same rule is duplicated as raw SQL in `bankTransactionsRepository`'s
 * money-flow `transferGap` aggregate (Node can't reach into a SQL sum). Keep
 * the two in sync — the "list ↔ detail parity" + "transferGap subtracts the
 * adjustment" tests guard it.
 */
function assessBalance(
  owedCents: number,
  paidOutCents: number,
  paymentCount: number,
  adjustmentCents: number | null,
): boolean | null {
  if (paymentCount === 0 && adjustmentCents === null) return null;
  const residual = owedCents - paidOutCents - (adjustmentCents ?? 0);
  return Math.abs(residual) <= transferBalanceToleranceCents(owedCents);
}

/**
 * What a round takes off the tip organization's share for card fees, as SQL:
 * the card fees of its finalized donations, if the round deducts them, but
 * never more than that organization's share. `round` is the SQL name of the
 * donation_transfers row. The transfer page works out the same figure in
 * `findByIdWithReconciliation`; keep the two in step.
 */
export function cardFeeDeductionSql(
  round: string,
  tipOrganizationInternalId: string | null,
) {
  if (!tipOrganizationInternalId) return sql`0`;
  const r = sql.raw(round);
  return sql`(CASE WHEN ${r}.deduct_card_fees THEN least(
    (SELECT coalesce(sum(fd.processor_fee_cents), 0) FROM donations fd
      WHERE fd.donation_transfer_id = ${r}.id AND fd.finalized = true),
    (SELECT coalesce(sum(tod.amount), 0) FROM organization_donations tod
      JOIN donations td ON td.id = tod.donation_id
      WHERE td.donation_transfer_id = ${r}.id AND td.finalized = true
        AND tod.organization_internal_id = ${tipOrganizationInternalId})
  ) ELSE 0 END)`;
}

export class DonationTransfersRepository {
  constructor(private database: Database = db) {}

  /**
   * Find paginated transfers with computed donationCount and totalAmount.
   */
  async findPaginated(options: {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    dateFrom?: string;
    dateTo?: string;
    /** whose share a round's card fees come off; null deducts nothing */
    tipOrganizationInternalId?: string | null;
  }) {
    const { page, pageSize, sortBy = "datetime", sortDir = "desc" } = options;
    const offset = (page - 1) * pageSize;
    const dir = sortDir === "desc" ? desc : asc;

    // Subquery: donation count and total amount per transfer (finalized only)
    const statsSq = this.database
      .select({
        transferId: donations.donationTransferId,
        donationCount: sql<number>`cast(count(*) as int)`.as("donation_count"),
        totalAmount:
          sql<number>`cast(coalesce(sum(${donations.amount}), 0) as int)`.as(
            "total_amount",
          ),
      })
      .from(donations)
      .where(
        sql`${donations.donationTransferId} is not null and ${donations.finalized} = true`,
      )
      .groupBy(donations.donationTransferId)
      .as("ts");

    const colMap: Record<string, Parameters<typeof dir>[0]> = {
      id: donationTransfers.id,
      datetime: donationTransfers.datetime,
      donationCount: statsSq.donationCount,
      totalAmount: statsSq.totalAmount,
    };

    const orderCol = colMap[sortBy] ?? donationTransfers.datetime;

    const conditions = [];
    if (options.dateFrom)
      conditions.push(gte(donationTransfers.datetime, options.dateFrom));
    if (options.dateTo)
      conditions.push(lte(donationTransfers.datetime, options.dateTo));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Σ abs(amount) of outgoing bank rows linked to the transfer + count
    const paidSq = this.database
      .select({
        transferId: bankTransactions.donationTransferId,
        paidOut:
          sql<number>`cast(coalesce(sum(abs(${bankTransactions.amount})), 0) as int)`.as(
            "paid_out",
          ),
        paymentCount: sql<number>`cast(count(*) as int)`.as("payment_count"),
      })
      .from(bankTransactions)
      .where(sql`${bankTransactions.donationTransferId} is not null`)
      .groupBy(bankTransactions.donationTransferId)
      .as("ps");

    // "Owed to orgs" = Σ organization_donations of the round's finalized
    // donations — the same figure `findByIdWithReconciliation` uses, so the
    // list "OK" column and the detail page agree.
    const owedSq = this.database
      .select({
        transferId: donations.donationTransferId,
        owed: sql<number>`cast(coalesce(sum(${organizationDonations.amount}), 0) as int)`.as(
          "owed",
        ),
      })
      .from(organizationDonations)
      .innerJoin(donations, eq(organizationDonations.donationId, donations.id))
      .where(
        sql`${donations.donationTransferId} is not null and ${donations.finalized} = true`,
      )
      .groupBy(donations.donationTransferId)
      .as("os");

    const [rows, countRows] = await Promise.all([
      this.database
        .select({
          id: donationTransfers.id,
          datetime: donationTransfers.datetime,
          recipient: donationTransfers.recipient,
          notes: donationTransfers.notes,
          createdAt: donationTransfers.createdAt,
          donationCount: statsSq.donationCount,
          totalAmount: statsSq.totalAmount,
          owedCents: owedSq.owed,
          paidOutCents: paidSq.paidOut,
          paymentCount: paidSq.paymentCount,
          adjustmentCents: donationTransfers.reconciliationAdjustmentCents,
          deductCardFees: donationTransfers.deductCardFees,
          cardFeeCents: sql<number>`(SELECT cast(coalesce(sum(fd.processor_fee_cents), 0) as int) FROM donations fd
            WHERE fd.donation_transfer_id = "donation_transfers"."id" AND fd.finalized = true)`,
          cardFeeDeductionCents: sql<number>`cast(${cardFeeDeductionSql(
            '"donation_transfers"',
            options.tipOrganizationInternalId ?? null,
          )} as int)`,
        })
        .from(donationTransfers)
        .leftJoin(statsSq, eq(donationTransfers.id, statsSq.transferId))
        .leftJoin(owedSq, eq(donationTransfers.id, owedSq.transferId))
        .leftJoin(paidSq, eq(donationTransfers.id, paidSq.transferId))
        .where(whereClause)
        .orderBy(dir(orderCol))
        .limit(pageSize)
        .offset(offset),
      this.database
        .select({ total: count() })
        .from(donationTransfers)
        .where(whereClause),
    ]);

    const data = rows.map((r) => {
      const deduction = Number(r.cardFeeDeductionCents ?? 0);
      const owed = Number(r.owedCents ?? 0) - deduction;
      const paidOut = Number(r.paidOutCents ?? 0);
      const payments = Number(r.paymentCount ?? 0);
      const adjustment =
        r.adjustmentCents === null ? null : Number(r.adjustmentCents);
      return {
        ...r,
        owedCents: owed,
        cardFeeCents: Number(r.cardFeeCents ?? 0),
        cardFeeDeductionCents: deduction,
        paidOutCents: paidOut,
        paymentCount: payments,
        adjustmentCents: adjustment,
        // owed still not accounted for, as on the transfer page
        residualCents: owed - paidOut - (adjustment ?? 0),
        balanced: assessBalance(owed, paidOut, payments, adjustment),
      };
    });

    return { data, total: countRows[0]?.total ?? 0 };
  }

  /**
   * Find a transfer by ID with all linked donations and per-org totals.
   *
   * Per-org totals are computed across the finalized donations' organizationDonations
   * rows — this is the primary output used for GWWC reporting.
   */
  async findByIdWithPerOrgTotals(id: number) {
    const transfer = await this.database.query.donationTransfers.findFirst({
      where: eq(donationTransfers.id, id),
      with: {
        donations: {
          orderBy: [desc(donations.datetime)],
          with: { organizationDonations: true },
        },
      },
    });

    if (!transfer) return undefined;

    // Aggregate per-org totals across finalized donations of this transfer
    const orgTotals = await this.database
      .select({
        organizationInternalId: organizationDonations.organizationInternalId,
        total:
          sql<number>`cast(coalesce(sum(${organizationDonations.amount}), 0) as int)`.as(
            "total",
          ),
        donationCount: sql<number>`cast(count(*) as int)`.as("donation_count"),
      })
      .from(organizationDonations)
      .innerJoin(donations, eq(organizationDonations.donationId, donations.id))
      .where(
        sql`${donations.donationTransferId} = ${id} and ${donations.finalized} = true`,
      )
      .groupBy(organizationDonations.organizationInternalId)
      .orderBy(
        desc(
          sql<number>`cast(coalesce(sum(${organizationDonations.amount}), 0) as int)`,
        ),
      );

    return { ...transfer, orgTotals };
  }

  /**
   * `findByIdWithPerOrgTotals` plus the outgoing bank payments linked to the
   * round and a reconciliation summary: `owed` (Σ per-org totals) vs `paidOut`
   * (Σ linked outgoing debits).
   */
  async findByIdWithReconciliation(
    id: number,
    tipOrganizationInternalId: string | null = null,
  ) {
    const base = await this.findByIdWithPerOrgTotals(id);
    if (!base) return undefined;

    // Card fees, and what comes off the tip organization's share for them:
    // the same rule as `cardFeeDeductionSql`.
    const finalized = base.donations.filter((d) => d.finalized);
    const cardFeeCents = finalized.reduce(
      (s, d) => s + (d.processorFeeCents ?? 0),
      0,
    );
    const tipShareCents = Number(
      base.orgTotals.find(
        (o) => o.organizationInternalId === tipOrganizationInternalId,
      )?.total ?? 0,
    );
    const cardFeeDeductionCents =
      base.deductCardFees && tipOrganizationInternalId
        ? Math.min(cardFeeCents, tipShareCents)
        : 0;
    // Donations paid out by a card processor whose fee isn't known yet: the
    // deduction is short by their fees until a statement import fills them in.
    const [unknown] = await this.database
      .select({ n: count() })
      .from(donations)
      .innerJoin(
        bankTransactions,
        eq(bankTransactions.archivingCode, donations.transactionId),
      )
      .where(
        sql`${donations.donationTransferId} = ${id} and ${donations.finalized} = true
          and ${bankTransactions.category} = 'card-payout' and ${donations.processorFeeCents} is null`,
      );

    const linkedPayments = await this.database
      .select({
        archivingCode: bankTransactions.archivingCode,
        date: bankTransactions.date,
        amountCents: bankTransactions.amount,
        counterpartyName: bankTransactions.counterpartyName,
        description: bankTransactions.description,
        note: bankTransactions.note,
      })
      .from(bankTransactions)
      .where(eq(bankTransactions.donationTransferId, id))
      // same-day payments in the bank's order, so saving a note can't reorder them
      .orderBy(asc(bankTransactions.date), asc(bankTransactions.archivingCode));
    const files = await new BankTransactionFilesRepository(
      this.database,
    ).findForCodes(linkedPayments.map((p) => p.archivingCode));
    const linkedBankTransactions = linkedPayments.map((p) => ({
      ...p,
      file: files.get(p.archivingCode) ?? null,
    }));

    const owedCents =
      base.orgTotals.reduce((s, o) => s + Number(o.total), 0) -
      cardFeeDeductionCents;
    const paidOutCents = linkedBankTransactions.reduce(
      (s, r) => s + Math.abs(Number(r.amountCents ?? 0)),
      0,
    );
    const differenceCents = owedCents - paidOutCents;
    const adjustmentCents =
      base.reconciliationAdjustmentCents === null
        ? null
        : Number(base.reconciliationAdjustmentCents);
    // owed still not accounted for after linked payments AND the operator's
    // adjustment — this is what the "OK" state keys on.
    const residualCents = differenceCents - (adjustmentCents ?? 0);

    return {
      ...base,
      linkedBankTransactions,
      owedCents,
      tipOrganizationInternalId,
      cardFeeCents,
      cardFeeDeductionCents,
      cardFeesNotDeductedCents: base.deductCardFees
        ? cardFeeCents - cardFeeDeductionCents
        : 0,
      donationsWithUnknownFee: Number(unknown?.n ?? 0),
      paidOutCents,
      differenceCents,
      adjustmentCents,
      reconciliationNote: base.reconciliationNote ?? null,
      residualCents,
      balanced: assessBalance(
        owedCents,
        paidOutCents,
        linkedBankTransactions.length,
        adjustmentCents,
      ),
    };
  }

  /**
   * Finalized donations in a date window that are not yet on any transfer —
   * the candidate list for building a new transfer round.
   */
  async previewDateRange(opts: { dateFrom: string; dateTo: string }) {
    const from = new Date(opts.dateFrom);
    const to = new Date(`${opts.dateTo}T23:59:59.999Z`);

    const rows = await this.database.query.donations.findMany({
      where: and(
        eq(donations.finalized, true),
        isNull(donations.donationTransferId),
        gte(donations.datetime, from),
        lte(donations.datetime, to),
      ),
      orderBy: [asc(donations.datetime)],
      with: {
        donor: { columns: { id: true, firstName: true, lastName: true } },
        organizationDonations: {
          columns: { organizationInternalId: true, amount: true },
        },
      },
    });

    return rows.map((d) => ({
      id: d.id,
      datetime: d.datetime,
      amountCents: d.amount,
      transactionId: d.transactionId,
      reconciled: d.transactionId !== null,
      donorName: d.donor
        ? [d.donor.firstName, d.donor.lastName].filter(Boolean).join(" ") ||
          `#${d.donor.id}`
        : null,
      orgSplit: d.organizationDonations.map((o) => ({
        internalId: o.organizationInternalId,
        amountCents: o.amount,
      })),
    }));
  }

  /** Every round with its owed total (Σ org donations of its finalized donations), oldest first. */
  async listWithOwed(): Promise<
    { id: number; datetime: string; owedCents: number }[]
  > {
    const res = await this.database.execute(sql`
      SELECT dt.id, dt.datetime,
        cast(coalesce((
          SELECT sum(od.amount) FROM organization_donations od
          JOIN donations d ON d.id = od.donation_id
          WHERE d.donation_transfer_id = dt.id AND d.finalized = true
        ), 0) as int) as owed
      FROM donation_transfers dt
      ORDER BY dt.datetime asc
    `);
    return res.rows.map((r) => ({
      id: Number(r.id),
      datetime: String(r.datetime),
      owedCents: Number(r.owed),
    }));
  }

  /** Is anything (a donation or a bank transaction) still linked to this transfer? */
  async hasLinks(id: number): Promise<boolean> {
    const [d] = await this.database
      .select({ n: count() })
      .from(donations)
      .where(eq(donations.donationTransferId, id));
    if (Number(d?.n ?? 0) > 0) return true;
    const [b] = await this.database
      .select({ n: count() })
      .from(bankTransactions)
      .where(eq(bankTransactions.donationTransferId, id));
    return Number(b?.n ?? 0) > 0;
  }

  /**
   * Find a donation transfer by ID
   */
  async findById(id: number): Promise<DonationTransfer | undefined> {
    return this.database.query.donationTransfers.findFirst({
      where: eq(donationTransfers.id, id),
    });
  }

  /**
   * Find a donation transfer by ID with related donations
   */
  async findByIdWithDonations(id: number) {
    return this.database.query.donationTransfers.findFirst({
      where: eq(donationTransfers.id, id),
      with: {
        donations: true,
      },
    });
  }

  /**
   * Get all donation transfers, ordered by date (newest first)
   */
  async findAll() {
    return this.database.query.donationTransfers.findMany({
      orderBy: [desc(donationTransfers.datetime)],
    });
  }

  /** Every transfer, newest first, with its donations. */
  async findAllWithDonations() {
    return this.database.query.donationTransfers.findMany({
      orderBy: [desc(donationTransfers.datetime)],
      with: { donations: true },
    });
  }

  /**
   * Create a new donation transfer
   */
  async create(
    data: Omit<NewDonationTransfer, "datetime"> & { datetime: string | Date },
  ): Promise<DonationTransfer> {
    const [transfer] = await this.database
      .insert(donationTransfers)
      .values({
        datetime:
          typeof data.datetime === "string"
            ? data.datetime
            : data.datetime.toISOString().split("T")[0], // Convert Date to YYYY-MM-DD
        recipient: data.recipient || null,
        notes: data.notes || null,
        deductCardFees: data.deductCardFees ?? false,
      })
      .returning();
    if (!transfer) throw new Error("Failed to insert donation transfer");
    return transfer;
  }

  /**
   * Update a donation transfer
   */
  async update(
    id: number,
    data: Partial<Omit<NewDonationTransfer, "datetime">> & {
      datetime?: string | Date;
    },
  ): Promise<DonationTransfer | undefined> {
    const updateData: Partial<NewDonationTransfer> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    // Only include fields that are provided
    if (data.recipient !== undefined) updateData.recipient = data.recipient;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.reconciliationAdjustmentCents !== undefined)
      updateData.reconciliationAdjustmentCents =
        data.reconciliationAdjustmentCents;
    if (data.reconciliationNote !== undefined)
      updateData.reconciliationNote = data.reconciliationNote;
    if (data.deductCardFees !== undefined)
      updateData.deductCardFees = data.deductCardFees;

    if (data.datetime) {
      updateData.datetime =
        typeof data.datetime === "string"
          ? data.datetime
          : data.datetime.toISOString().split("T")[0]; // Convert Date to YYYY-MM-DD
    }

    const [transfer] = await this.database
      .update(donationTransfers)
      .set(updateData)
      .where(eq(donationTransfers.id, id))
      .returning();
    return transfer;
  }

  /**
   * Delete a donation transfer. Refuses while any donation or bank transaction
   * still references it — unlink those first. The FK also enforces this, so a
   * link created between the check and the delete still surfaces as `has-links`
   * (foreign_key_violation, SQLSTATE 23503) rather than a 500.
   */
  async delete(
    id: number,
  ): Promise<{ ok: true } | { ok: false; reason: "has-links" | "not-found" }> {
    if (await this.hasLinks(id)) return { ok: false, reason: "has-links" };
    try {
      const deleted = await this.database
        .delete(donationTransfers)
        .where(eq(donationTransfers.id, id))
        .returning({ id: donationTransfers.id });
      return deleted.length > 0
        ? { ok: true }
        : { ok: false, reason: "not-found" };
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "23503"
      ) {
        return { ok: false, reason: "has-links" };
      }
      throw err;
    }
  }
}

export const donationTransfersRepository = new DonationTransfersRepository();
