import {
  eq,
  desc,
  asc,
  sql,
  count,
  sum,
  and,
  gte,
  lte,
  isNull,
} from "drizzle-orm";
import { db, type Database } from "../client";
import {
  donationTransfers,
  donations,
  organizationDonations,
  bankTransactions,
  type DonationTransfer,
  type NewDonationTransfer,
} from "../schema";

interface FindAllOptions {
  withDonations?: boolean;
}

/**
 * How far `paid out` may drift from `owed` before a transfer round is flagged:
 * the larger of €10 or 0.5% of the owed total. Card-fee absorption and the
 * outgoing SEPA fee make a little slack normal; a bigger gap means a payment is
 * missing or on the wrong round.
 */
export function transferBalanceToleranceCents(owedCents: number): number {
  return Math.max(1000, Math.round(Math.abs(owedCents) * 0.005));
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
      const owed = Number(r.owedCents ?? 0);
      const paidOut = Number(r.paidOutCents ?? 0);
      const payments = Number(r.paymentCount ?? 0);
      return {
        ...r,
        owedCents: owed,
        paidOutCents: paidOut,
        paymentCount: payments,
        // null = nothing linked yet (not assessable)
        balanced:
          payments === 0
            ? null
            : Math.abs(owed - paidOut) <= transferBalanceToleranceCents(owed),
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
  async findByIdWithReconciliation(id: number) {
    const base = await this.findByIdWithPerOrgTotals(id);
    if (!base) return undefined;

    const linkedBankTransactions = await this.database
      .select({
        archivingCode: bankTransactions.archivingCode,
        date: bankTransactions.date,
        amountCents: bankTransactions.amount,
        counterpartyName: bankTransactions.counterpartyName,
        description: bankTransactions.description,
      })
      .from(bankTransactions)
      .where(eq(bankTransactions.donationTransferId, id))
      .orderBy(asc(bankTransactions.date));

    const owedCents = base.orgTotals.reduce((s, o) => s + Number(o.total), 0);
    const paidOutCents = linkedBankTransactions.reduce(
      (s, r) => s + Math.abs(Number(r.amountCents ?? 0)),
      0,
    );
    const differenceCents = owedCents - paidOutCents;

    return {
      ...base,
      linkedBankTransactions,
      owedCents,
      paidOutCents,
      differenceCents,
      balanced:
        linkedBankTransactions.length > 0 &&
        Math.abs(differenceCents) <= transferBalanceToleranceCents(owedCents),
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
      reconciled: d.transactionId != null,
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
    return (res.rows as Record<string, unknown>[]).map((r) => ({
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
  async findAll(options?: FindAllOptions) {
    return this.database.query.donationTransfers.findMany({
      orderBy: [desc(donationTransfers.datetime)],
      with: options?.withDonations ? { donations: true } : undefined,
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
        (err as { code?: string }).code === "23503"
      ) {
        return { ok: false, reason: "has-links" };
      }
      throw err;
    }
  }
}

export const donationTransfersRepository = new DonationTransfersRepository();
