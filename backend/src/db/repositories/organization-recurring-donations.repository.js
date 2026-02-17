'use strict';

const { eq } = require('drizzle-orm');
const { db } = require('../client');
const { organizationRecurringDonations } = require('../schema');

class OrganizationRecurringDonationsRepository {
  /**
   * Find all organization recurring donations (for export)
   */
  async findAll() {
    return db.query.organizationRecurringDonations.findMany({
      orderBy: (organizationRecurringDonations, { asc }) => [asc(organizationRecurringDonations.id)],
      with: {
        recurringDonation: true,
      },
    });
  }

  /**
   * Find organization recurring donations by recurring donation ID
   */
  async findByRecurringDonationId(recurringDonationId) {
    return db.query.organizationRecurringDonations.findMany({
      where: eq(organizationRecurringDonations.recurringDonationId, recurringDonationId),
    });
  }

  /**
   * Find organization recurring donations by organization internal ID
   */
  async findByOrganizationInternalId(organizationInternalId) {
    return db.query.organizationRecurringDonations.findMany({
      where: eq(organizationRecurringDonations.organizationInternalId, organizationInternalId),
    });
  }

  /**
   * Create organization recurring donations (junction records)
   */
  async createMany(data) {
    if (data.length === 0) return [];

    return db.insert(organizationRecurringDonations)
      .values(data)
      .returning();
  }

  /**
   * Create a single organization recurring donation
   */
  async create(data) {
    const [orgRecurringDonation] = await db.insert(organizationRecurringDonations)
      .values(data)
      .returning();
    return orgRecurringDonation;
  }

  /**
   * Update organization recurring donations for a specific recurring donation
   * (Delete old ones and create new ones)
   */
  async updateForRecurringDonation(recurringDonationId, data) {
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
  async deleteByRecurringDonationId(recurringDonationId) {
    await db.delete(organizationRecurringDonations)
      .where(eq(organizationRecurringDonations.recurringDonationId, recurringDonationId));
  }

  /**
   * Check if an organization has any recurring donations
   */
  async organizationHasRecurringDonations(organizationInternalId) {
    const result = await db.query.organizationRecurringDonations.findFirst({
      where: eq(organizationRecurringDonations.organizationInternalId, organizationInternalId),
    });
    return !!result;
  }
}

const organizationRecurringDonationsRepository = new OrganizationRecurringDonationsRepository();

module.exports = { OrganizationRecurringDonationsRepository, organizationRecurringDonationsRepository };
