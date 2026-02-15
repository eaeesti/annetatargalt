import { eq } from 'drizzle-orm';
import { db } from '../client';
import { organizationRecurringDonations } from '../schema';

export class OrganizationRecurringDonationsRepository {
  /**
   * Find organization recurring donations by recurring donation ID
   */
  async findByRecurringDonationId(recurringDonationId: number) {
    return db.query.organizationRecurringDonations.findMany({
      where: eq(organizationRecurringDonations.recurringDonationId, recurringDonationId),
    });
  }

  /**
   * Find organization recurring donations by organization internal ID
   */
  async findByOrganizationInternalId(organizationInternalId: string) {
    return db.query.organizationRecurringDonations.findMany({
      where: eq(organizationRecurringDonations.organizationInternalId, organizationInternalId),
    });
  }

  /**
   * Create organization recurring donations (junction records)
   */
  async createMany(data: Array<{
    recurringDonationId: number;
    organizationInternalId: string;
    amount: number;
  }>) {
    if (data.length === 0) return [];

    return db.insert(organizationRecurringDonations)
      .values(data)
      .returning();
  }

  /**
   * Create a single organization recurring donation
   */
  async create(data: {
    recurringDonationId: number;
    organizationInternalId: string;
    amount: number;
  }) {
    const [orgRecurringDonation] = await db.insert(organizationRecurringDonations)
      .values(data)
      .returning();
    return orgRecurringDonation;
  }

  /**
   * Update organization recurring donations for a specific recurring donation
   * (Delete old ones and create new ones)
   */
  async updateForRecurringDonation(recurringDonationId: number, data: Array<{
    organizationInternalId: string;
    amount: number;
  }>) {
    // Delete existing
    await db.delete(organizationRecurringDonations)
      .where(eq(organizationRecurringDonations.recurringDonationId, recurringDonationId));

    // Create new ones
    if (data.length === 0) return [];

    return this.createMany(data.map(item => ({
      recurringDonationId,
      ...item,
    })));
  }

  /**
   * Delete organization recurring donations by recurring donation ID
   */
  async deleteByRecurringDonationId(recurringDonationId: number) {
    await db.delete(organizationRecurringDonations)
      .where(eq(organizationRecurringDonations.recurringDonationId, recurringDonationId));
  }

  /**
   * Check if an organization has any recurring donations
   */
  async organizationHasRecurringDonations(organizationInternalId: string) {
    const result = await db.query.organizationRecurringDonations.findFirst({
      where: eq(organizationRecurringDonations.organizationInternalId, organizationInternalId),
    });
    return !!result;
  }
}

export const organizationRecurringDonationsRepository = new OrganizationRecurringDonationsRepository();
