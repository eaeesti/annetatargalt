import { eq, and, desc, asc, sql, count, gte } from "drizzle-orm";
import { db, type Database } from "../client";
import {
  recurringDonations,
  donors,
  donations,
  type RecurringDonation,
  type NewRecurringDonation,
} from "../schema";
import {
  RECURRING_ACTIVITY_WINDOW_DAYS,
  recurringDonationStatus,
  type RecurringDonationStatus,
} from "./recurring-activity";

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
  }) {
    const { page, pageSize, sortBy = "id", sortDir = "asc" } = options;
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

    // Subquery: recurring donations with a finalized linked donation within
    // the current activity window — the "active" half of the status column.
    const recentCutoff = new Date();
    recentCutoff.setDate(
      recentCutoff.getDate() - RECURRING_ACTIVITY_WINDOW_DAYS,
    );
    const recentSq = this.database
      .select({ recurringDonationId: donations.recurringDonationId })
      .from(donations)
      .where(
        and(
          eq(donations.finalized, true),
          sql`${donations.recurringDonationId} is not null`,
          gte(donations.datetime, recentCutoff),
        ),
      )
      .groupBy(donations.recurringDonationId)
      .as("rs");

    const statusRankSql = sql`
      CASE
        WHEN ${recentSq.recurringDonationId} IS NOT NULL THEN 2
        WHEN ${statsSq.recurringDonationId} IS NOT NULL THEN 1
        ELSE 0
      END
    `;

    const colMap: Record<string, Parameters<typeof dir>[0]> = {
      id: recurringDonations.id,
      amount: recurringDonations.amount,
      datetime: recurringDonations.datetime,
      donorLastName: donors.lastName,
      donationCount: statsSq.donationCount,
      lastDonationDate: statsSq.lastDonationDate,
      status: statusRankSql,
    };

    const orderCol = colMap[sortBy] ?? recurringDonations.id;

    const [rows, countRows] = await Promise.all([
      this.database
        .select({
          id: recurringDonations.id,
          amount: recurringDonations.amount,
          datetime: recurringDonations.datetime,
          companyName: recurringDonations.companyName,
          donorId: recurringDonations.donorId,
          donorFirstName: donors.firstName,
          donorLastName: donors.lastName,
          donorEmail: donors.email,
          donationCount: statsSq.donationCount,
          lastDonationDate: statsSq.lastDonationDate,
          status: sql<RecurringDonationStatus>`
            CASE
              WHEN ${recentSq.recurringDonationId} IS NOT NULL THEN 'active'
              WHEN ${statsSq.recurringDonationId} IS NOT NULL THEN 'stopped'
              ELSE 'neverStarted'
            END
          `,
        })
        .from(recurringDonations)
        .innerJoin(donors, eq(recurringDonations.donorId, donors.id))
        .leftJoin(
          statsSq,
          eq(recurringDonations.id, statsSq.recurringDonationId),
        )
        .leftJoin(
          recentSq,
          eq(recurringDonations.id, recentSq.recurringDonationId),
        )
        .orderBy(dir(orderCol))
        .limit(pageSize)
        .offset(offset),
      this.database.select({ total: count() }).from(recurringDonations),
    ]);

    return { data: rows, total: countRows[0]?.total ?? 0 };
  }

  /**
   * Find a recurring donation by ID with full detail (donor, org splits,
   * linked donations with org splits). `status` is computed the same
   * payment-based way `findPaginated` does (see recurringDonationStatus),
   * from the `donations` already fetched here, instead of a second DB query.
   */
  async findByIdWithFullDonations(id: number) {
    const rd = await this.database.query.recurringDonations.findFirst({
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
    if (!rd) return undefined;

    return { ...rd, status: recurringDonationStatus(rd.donations) };
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
   * Delete a recurring donation
   */
  async delete(id: number): Promise<void> {
    await this.database
      .delete(recurringDonations)
      .where(eq(recurringDonations.id, id));
  }

  /**
   * Compact grid dataset: every donor with a finalized donation, the total
   * they gave in each month since their first, and whether they are a
   * currently active recurring donor — a finalized recurring payment within
   * RECURRING_ACTIVITY_WINDOW_DAYS — so the grid can show this month as
   * expected rather than missed. Ordered by donor last/first name.
   */
  async getGrid(): Promise<
    Array<{
      donorId: number;
      donorName: string;
      startMonth: string; // "YYYY-MM" of the donor's first finalized donation
      monthAmounts: Record<string, number>; // "YYYY-MM" -> total cents donated that month
      recurringActive: boolean;
    }>
  > {
    const recentCutoff = new Date();
    recentCutoff.setDate(
      recentCutoff.getDate() - RECURRING_ACTIVITY_WINDOW_DAYS,
    );
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
        json_object_agg(m.month, m.total)                     AS "monthAmounts",
        EXISTS (
          SELECT 1 FROM donations r
          WHERE r.donor_id = d.id
            AND r.finalized = true
            AND r.recurring_donation_id IS NOT NULL
            AND r.datetime >= ${recentCutoff.toISOString()}
        )                                                     AS "recurringActive"
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
      recurringActive: r.recurringActive === true,
    }));
  }
}

export const recurringDonationsRepository = new RecurringDonationsRepository();
