import { eq, sql } from "drizzle-orm";
import { db, type Database } from "../client";
import {
  organizationDonations,
  donations,
  type OrganizationDonation,
  type NewOrganizationDonation,
} from "../schema";

export class OrganizationDonationsRepository {
  constructor(private database: Database = db) {}

  /**
   * Find all organization donations (for export)
   */
  async findAll() {
    return this.database.query.organizationDonations.findMany({
      orderBy: (organizationDonations, { asc }) => [
        asc(organizationDonations.id),
      ],
      with: {
        donation: true,
      },
    });
  }

  /**
   * Find organization donations by donation ID
   */
  async findByDonationId(donationId: number): Promise<OrganizationDonation[]> {
    return this.database.query.organizationDonations.findMany({
      where: eq(organizationDonations.donationId, donationId),
    });
  }

  /**
   * Find organization donations by organization internal ID
   */
  async findByOrganizationInternalId(
    organizationInternalId: string,
  ): Promise<OrganizationDonation[]> {
    return this.database.query.organizationDonations.findMany({
      where: eq(
        organizationDonations.organizationInternalId,
        organizationInternalId,
      ),
    });
  }

  /**
   * Create organization donations (junction records)
   */
  async createMany(
    data: NewOrganizationDonation[],
  ): Promise<OrganizationDonation[]> {
    if (data.length === 0) return [];

    return this.database.insert(organizationDonations).values(data).returning();
  }

  /**
   * Create a single organization donation
   */
  async create(data: NewOrganizationDonation): Promise<OrganizationDonation> {
    const [orgDonation] = await this.database
      .insert(organizationDonations)
      .values(data)
      .returning();
    if (!orgDonation) throw new Error("Failed to insert organization donation");
    return orgDonation;
  }

  /**
   * Update organization donations for a specific donation
   * (Delete old ones and create new ones)
   */
  async updateForDonation(
    donationId: number,
    data: Omit<NewOrganizationDonation, "donationId">[],
  ): Promise<OrganizationDonation[]> {
    // Delete existing
    await this.database
      .delete(organizationDonations)
      .where(eq(organizationDonations.donationId, donationId));

    // Create new ones
    if (data.length === 0) return [];

    return this.createMany(
      data.map((item) => ({
        donationId,
        ...item,
      })),
    );
  }

  /**
   * Delete organization donations by donation ID
   */
  async deleteByDonationId(donationId: number): Promise<void> {
    await this.database
      .delete(organizationDonations)
      .where(eq(organizationDonations.donationId, donationId));
  }

  /**
   * Aggregate per-org stats across all finalized donations.
   * Returns one row per organizationInternalId: totalDonated, donationCount, lastDonationDate.
   */
  async getStats() {
    return this.database
      .select({
        organizationInternalId: organizationDonations.organizationInternalId,
        totalDonated:
          sql<number>`cast(coalesce(sum(${organizationDonations.amount}), 0) as int)`.as(
            "total_donated",
          ),
        donationCount: sql<number>`cast(count(*) as int)`.as("donation_count"),
        lastDonationDate: sql<string | null>`max(${donations.datetime})`.as(
          "last_donation_date",
        ),
      })
      .from(organizationDonations)
      .innerJoin(donations, eq(organizationDonations.donationId, donations.id))
      .where(sql`${donations.finalized} = true`)
      .groupBy(organizationDonations.organizationInternalId);
  }

  /**
   * What finalized donations gave an organization each month, from the month
   * of its first one to the current month. Months it got nothing in are
   * there too, as 0, so a chart of them has no gaps. Empty if it never got
   * anything.
   */
  async getMonthlyTotals(organizationInternalId: string) {
    const result = await this.database.execute<{
      month: string; // "YYYY-MM"
      total: number; // cents
      count: number;
    }>(sql`
      WITH totals AS (
        SELECT date_trunc('month', d.datetime) AS month,
          sum(od.amount) AS total,
          count(*) AS count
        FROM organization_donations od
        JOIN donations d ON d.id = od.donation_id
        WHERE d.finalized = true
          AND od.organization_internal_id = ${organizationInternalId}
        GROUP BY 1
      )
      SELECT to_char(m.month, 'YYYY-MM') AS month,
        cast(coalesce(t.total, 0) as int) AS total,
        cast(coalesce(t.count, 0) as int) AS count
      FROM generate_series(
        (SELECT min(month) FROM totals),
        date_trunc('month', localtimestamp),
        interval '1 month'
      ) AS m(month)
      LEFT JOIN totals t ON t.month = m.month
      ORDER BY m.month
    `);
    return result.rows;
  }

  /**
   * Check if an organization has any donations
   */
  async organizationHasDonations(
    organizationInternalId: string,
  ): Promise<boolean> {
    const result = await this.database.query.organizationDonations.findFirst({
      where: eq(
        organizationDonations.organizationInternalId,
        organizationInternalId,
      ),
    });
    return !!result;
  }
}

export const organizationDonationsRepository =
  new OrganizationDonationsRepository();
