import { eq, desc, asc, sql, count, sum, and, gte, lte } from "drizzle-orm";
import { db, type Database } from "../client";
import {
  donationTransfers,
  donations,
  organizationDonations,
  type DonationTransfer,
  type NewDonationTransfer,
} from "../schema";

interface FindAllOptions {
  withDonations?: boolean;
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
        })
        .from(donationTransfers)
        .leftJoin(statsSq, eq(donationTransfers.id, statsSq.transferId))
        .where(whereClause)
        .orderBy(dir(orderCol))
        .limit(pageSize)
        .offset(offset),
      this.database
        .select({ total: count() })
        .from(donationTransfers)
        .where(whereClause),
    ]);

    return { data: rows, total: countRows[0]?.total ?? 0 };
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
   * Delete a donation transfer (only if no donations are linked)
   */
  async delete(id: number): Promise<void> {
    await this.database
      .delete(donationTransfers)
      .where(eq(donationTransfers.id, id));
  }
}

export const donationTransfersRepository = new DonationTransfersRepository();
