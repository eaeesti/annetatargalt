import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../client';
import { organizationDonations } from '../schema';

export class OrganizationDonationsRepository {
  /**
   * Find organization donations by donation ID
   */
  async findByDonationId(donationId: number) {
    return db.query.organizationDonations.findMany({
      where: eq(organizationDonations.donationId, donationId),
    });
  }

  /**
   * Find organization donations by organization internal ID
   */
  async findByOrganizationInternalId(organizationInternalId: string) {
    return db.query.organizationDonations.findMany({
      where: eq(organizationDonations.organizationInternalId, organizationInternalId),
    });
  }

  /**
   * Create organization donations (junction records)
   */
  async createMany(data: Array<{
    donationId: number;
    organizationInternalId: string;
    amount: number;
  }>) {
    if (data.length === 0) return [];

    return db.insert(organizationDonations)
      .values(data)
      .returning();
  }

  /**
   * Create a single organization donation
   */
  async create(data: {
    donationId: number;
    organizationInternalId: string;
    amount: number;
  }) {
    const [orgDonation] = await db.insert(organizationDonations)
      .values(data)
      .returning();
    return orgDonation;
  }

  /**
   * Update organization donations for a specific donation
   * (Delete old ones and create new ones)
   */
  async updateForDonation(donationId: number, data: Array<{
    organizationInternalId: string;
    amount: number;
  }>) {
    // Delete existing
    await db.delete(organizationDonations)
      .where(eq(organizationDonations.donationId, donationId));

    // Create new ones
    if (data.length === 0) return [];

    return this.createMany(data.map(item => ({
      donationId,
      ...item,
    })));
  }

  /**
   * Delete organization donations by donation ID
   */
  async deleteByDonationId(donationId: number) {
    await db.delete(organizationDonations)
      .where(eq(organizationDonations.donationId, donationId));
  }

  /**
   * Check if an organization has any donations
   */
  async organizationHasDonations(organizationInternalId: string) {
    const result = await db.query.organizationDonations.findFirst({
      where: eq(organizationDonations.organizationInternalId, organizationInternalId),
    });
    return !!result;
  }
}

export const organizationDonationsRepository = new OrganizationDonationsRepository();
