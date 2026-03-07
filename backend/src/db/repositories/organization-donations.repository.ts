import { eq } from "drizzle-orm";
import { db, type Database } from "../client";
import { organizationDonations, type OrganizationDonation, type NewOrganizationDonation } from "../schema";

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
  async findByOrganizationInternalId(organizationInternalId: string): Promise<OrganizationDonation[]> {
    return this.database.query.organizationDonations.findMany({
      where: eq(
        organizationDonations.organizationInternalId,
        organizationInternalId
      ),
    });
  }

  /**
   * Create organization donations (junction records)
   */
  async createMany(data: NewOrganizationDonation[]): Promise<OrganizationDonation[]> {
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
    data: Omit<NewOrganizationDonation, "donationId">[]
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
      }))
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
   * Check if an organization has any donations
   */
  async organizationHasDonations(organizationInternalId: string): Promise<boolean> {
    const result = await this.database.query.organizationDonations.findFirst({
      where: eq(
        organizationDonations.organizationInternalId,
        organizationInternalId
      ),
    });
    return !!result;
  }
}

export const organizationDonationsRepository = new OrganizationDonationsRepository();
