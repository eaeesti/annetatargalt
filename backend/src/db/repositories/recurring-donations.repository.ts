import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import { db, type Database } from "../client";
import {
  recurringDonations,
  donors,
  donations,
  type RecurringDonation,
  type NewRecurringDonation,
} from "../schema";

export class RecurringDonationsRepository {
  constructor(private database: Database = db) {}

  /**
   * Find all recurring donations (for export)
   */
  async findAll() {
    return this.database.query.recurringDonations.findMany({
      orderBy: (recurringDonations, { asc }) => [asc(recurringDonations.id)],
      with: {
        donor: true,
      },
    });
  }

  /**
   * Find a recurring donation by ID
   */
  async findById(id: number): Promise<RecurringDonation | undefined> {
    return this.database.query.recurringDonations.findFirst({
      where: eq(recurringDonations.id, id),
    });
  }

  /**
   * Find a recurring donation by ID with related data
   */
  async findByIdWithRelations(id: number) {
    return this.database.query.recurringDonations.findFirst({
      where: eq(recurringDonations.id, id),
      with: {
        donor: true,
        organizationRecurringDonations: true,
        donations: true,
      },
    });
  }

  /**
   * Find paginated recurring donations with donor info and donation stats.
   */
  async findPaginated(options: {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    active?: boolean;
  }) {
    const { page, pageSize, sortBy = "id", sortDir = "asc", active } = options;
    const offset = (page - 1) * pageSize;
    const dir = sortDir === "desc" ? desc : asc;

    // Subquery: finalized donation count + last donation date per recurring donation
    const statsSq = this.database
      .select({
        recurringDonationId: donations.recurringDonationId,
        donationCount: sql<number>`cast(count(*) as int)`.as("donation_count"),
        lastDonationDate: sql<string | null>`max(${donations.datetime})`.as(
          "last_donation_date",
        ),
      })
      .from(donations)
      .where(
        and(
          eq(donations.finalized, true),
          sql`${donations.recurringDonationId} is not null`,
        ),
      )
      .groupBy(donations.recurringDonationId)
      .as("ds");

    const colMap: Record<string, Parameters<typeof dir>[0]> = {
      id: recurringDonations.id,
      active: recurringDonations.active,
      amount: recurringDonations.amount,
      datetime: recurringDonations.datetime,
      donorLastName: donors.lastName,
      donationCount: statsSq.donationCount,
      lastDonationDate: statsSq.lastDonationDate,
    };

    const orderCol = colMap[sortBy] ?? recurringDonations.id;

    const whereClause =
      active !== undefined ? eq(recurringDonations.active, active) : undefined;

    const [rows, countRows] = await Promise.all([
      this.database
        .select({
          id: recurringDonations.id,
          active: recurringDonations.active,
          amount: recurringDonations.amount,
          datetime: recurringDonations.datetime,
          companyName: recurringDonations.companyName,
          donorId: recurringDonations.donorId,
          donorFirstName: donors.firstName,
          donorLastName: donors.lastName,
          donorEmail: donors.email,
          donationCount: statsSq.donationCount,
          lastDonationDate: statsSq.lastDonationDate,
        })
        .from(recurringDonations)
        .innerJoin(donors, eq(recurringDonations.donorId, donors.id))
        .leftJoin(
          statsSq,
          eq(recurringDonations.id, statsSq.recurringDonationId),
        )
        .where(whereClause)
        .orderBy(dir(orderCol))
        .limit(pageSize)
        .offset(offset),
      this.database
        .select({ total: count() })
        .from(recurringDonations)
        .where(whereClause),
    ]);

    return { data: rows, total: countRows[0]?.total ?? 0 };
  }

  /**
   * Find a recurring donation by ID with full detail (donor, org splits, linked donations with org splits).
   */
  async findByIdWithFullDonations(id: number) {
    return this.database.query.recurringDonations.findFirst({
      where: eq(recurringDonations.id, id),
      with: {
        donor: true,
        organizationRecurringDonations: true,
        donations: {
          orderBy: [desc(donations.datetime)],
          with: { organizationDonations: true },
        },
      },
    });
  }

  /**
   * Find recurring donations by donor ID
   */
  async findByDonorId(donorId: number): Promise<RecurringDonation[]> {
    return this.database.query.recurringDonations.findMany({
      where: eq(recurringDonations.donorId, donorId),
      orderBy: [desc(recurringDonations.datetime)],
    });
  }

  /**
   * Find active recurring donations
   */
  async findActive() {
    return this.database.query.recurringDonations.findMany({
      where: eq(recurringDonations.active, true),
      orderBy: [desc(recurringDonations.datetime)],
      with: {
        donor: true,
        organizationRecurringDonations: true,
      },
    });
  }

  /**
   * Find active recurring donations by donor ID
   */
  async findActiveByDonorId(donorId: number): Promise<RecurringDonation[]> {
    return this.database.query.recurringDonations.findMany({
      where: and(
        eq(recurringDonations.donorId, donorId),
        eq(recurringDonations.active, true),
      ),
      orderBy: [desc(recurringDonations.datetime)],
    });
  }

  /**
   * Find recurring donation by company code
   */
  async findByCompanyCode(
    companyCode: string,
  ): Promise<RecurringDonation | undefined> {
    return this.database.query.recurringDonations.findFirst({
      where: eq(recurringDonations.companyCode, companyCode),
      orderBy: [desc(recurringDonations.datetime)],
    });
  }

  /**
   * Create a new recurring donation
   */
  async create(
    data: NewRecurringDonation & { datetime?: string | Date },
  ): Promise<RecurringDonation> {
    const [recurringDonation] = await this.database
      .insert(recurringDonations)
      .values({
        donorId: data.donorId,
        amount: data.amount,
        active: data.active !== undefined ? data.active : true,
        companyName: data.companyName || null,
        companyCode: data.companyCode || null,
        comment: data.comment || null,
        bank: data.bank || null,
        datetime:
          typeof data.datetime === "string"
            ? new Date(data.datetime)
            : (data.datetime ?? new Date()),
      })
      .returning();
    if (!recurringDonation)
      throw new Error("Failed to insert recurring donation");
    return recurringDonation;
  }

  /**
   * Update a recurring donation
   */
  async update(
    id: number,
    data: Partial<NewRecurringDonation>,
  ): Promise<RecurringDonation | undefined> {
    const [recurringDonation] = await this.database
      .update(recurringDonations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(recurringDonations.id, id))
      .returning();
    return recurringDonation;
  }

  /**
   * Deactivate a recurring donation
   */
  async deactivate(id: number): Promise<RecurringDonation | undefined> {
    return this.update(id, { active: false });
  }

  /**
   * Activate a recurring donation
   */
  async activate(id: number): Promise<RecurringDonation | undefined> {
    return this.update(id, { active: true });
  }

  /**
   * Delete a recurring donation
   */
  async delete(id: number): Promise<void> {
    await this.database
      .delete(recurringDonations)
      .where(eq(recurringDonations.id, id));
  }

  /**
   * Compact grid dataset: all active recurring donations with the set of months
   * that have a linked finalized donation, ordered by donor last/first name.
   */
  async getGrid(): Promise<
    Array<{
      donorId: number;
      donorName: string;
      startMonth: string; // "YYYY-MM" of the donor's first finalized donation
      monthAmounts: Record<string, number>; // "YYYY-MM" -> total cents donated that month
    }>
  > {
    const result = await this.database.execute(sql`
      WITH monthly AS (
        SELECT
          don.donor_id,
          to_char(don.datetime, 'YYYY-MM')  AS month,
          cast(sum(don.amount) as int)       AS total
        FROM donations don
        WHERE don.finalized = true
          AND don.donor_id IS NOT NULL
        GROUP BY don.donor_id, to_char(don.datetime, 'YYYY-MM')
      )
      SELECT
        d.id                                                  AS "donorId",
        concat(d.first_name, ' ', d.last_name)               AS "donorName",
        min(m.month)                                          AS "startMonth",
        json_object_agg(m.month, m.total)                     AS "monthAmounts"
      FROM donors d
      JOIN monthly m ON m.donor_id = d.id
      GROUP BY d.id
      ORDER BY d.last_name, d.first_name, d.id
    `);
    return (result.rows as Array<Record<string, unknown>>).map((r) => ({
      donorId: Number(r.donorId),
      donorName: String(r.donorName),
      startMonth: String(r.startMonth),
      monthAmounts: (r.monthAmounts as Record<string, number>) ?? {},
    }));
  }
}

export const recurringDonationsRepository = new RecurringDonationsRepository();
