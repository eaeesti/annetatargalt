import { eq } from "drizzle-orm";
import { db, type Database } from "../client";
import {
  organizationRecurringDonations,
  type OrganizationRecurringDonation,
  type NewOrganizationRecurringDonation
} from "../schema";

export class OrganizationRecurringDonationsRepository {
  constructor(private database: Database = db) {}

  /**
   * Find all organization recurring donations (for export)
   */
  async findAll() {
    return this.database.query.organizationRecurringDonations.findMany({
      orderBy: (organizationRecurringDonations, { asc }) => [
        asc(organizationRecurringDonations.id),
      ],
      with: {
        recurringDonation: true,
      },
    });
  }

  /**
   * Find organization recurring donations by recurring donation ID
   */
  async findByRecurringDonationId(recurringDonationId: number): Promise<OrganizationRecurringDonation[]> {
    return this.database.query.organizationRecurringDonations.findMany({
      where: eq(
        organizationRecurringDonations.recurringDonationId,
        recurringDonationId
      ),
    });
  }

  /**
   * Find organization recurring donations by organization internal ID
   */
  async findByOrganizationInternalId(organizationInternalId: string): Promise<OrganizationRecurringDonation[]> {
    return this.database.query.organizationRecurringDonations.findMany({
      where: eq(
        organizationRecurringDonations.organizationInternalId,
        organizationInternalId
      ),
    });
  }

  /**
   * Create organization recurring donations (junction records)
   */
  async createMany(data: NewOrganizationRecurringDonation[]): Promise<OrganizationRecurringDonation[]> {
    if (data.length === 0) return [];

    return this.database.insert(organizationRecurringDonations).values(data).returning();
  }

  /**
   * Create a single organization recurring donation
   */
  async create(data: NewOrganizationRecurringDonation): Promise<OrganizationRecurringDonation> {
    const [orgRecurringDonation] = await this.database
      .insert(organizationRecurringDonations)
      .values(data)
      .returning();
    return orgRecurringDonation!;
  }

  /**
   * Update organization recurring donations for a specific recurring donation
   * (Delete old ones and create new ones)
   */
  async updateForRecurringDonation(
    recurringDonationId: number,
    data: Omit<NewOrganizationRecurringDonation, "recurringDonationId">[]
  ): Promise<OrganizationRecurringDonation[]> {
    // Delete existing
    await this.database
      .delete(organizationRecurringDonations)
      .where(
        eq(
          organizationRecurringDonations.recurringDonationId,
          recurringDonationId
        )
      );

    // Create new ones
    if (data.length === 0) return [];

    return this.createMany(
      data.map((item) => ({
        recurringDonationId,
        ...item,
      }))
    );
  }

  /**
   * Delete organization recurring donations by recurring donation ID
   */
  async deleteByRecurringDonationId(recurringDonationId: number): Promise<void> {
    await this.database
      .delete(organizationRecurringDonations)
      .where(
        eq(
          organizationRecurringDonations.recurringDonationId,
          recurringDonationId
        )
      );
  }

  /**
   * Check if an organization has any recurring donations
   */
  async organizationHasRecurringDonations(organizationInternalId: string): Promise<boolean> {
    const result = await this.database.query.organizationRecurringDonations.findFirst({
      where: eq(
        organizationRecurringDonations.organizationInternalId,
        organizationInternalId
      ),
    });
    return !!result;
  }
}

export const organizationRecurringDonationsRepository =
  new OrganizationRecurringDonationsRepository();
