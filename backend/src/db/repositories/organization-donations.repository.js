"use strict";

const { eq } = require("drizzle-orm");
const { db } = require("../client");
const { organizationDonations } = require("../schema");

class OrganizationDonationsRepository {
  /**
   * Find all organization donations (for export)
   */
  async findAll() {
    return db.query.organizationDonations.findMany({
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
  async findByDonationId(donationId) {
    return db.query.organizationDonations.findMany({
      where: eq(organizationDonations.donationId, donationId),
    });
  }

  /**
   * Find organization donations by organization internal ID
   */
  async findByOrganizationInternalId(organizationInternalId) {
    return db.query.organizationDonations.findMany({
      where: eq(
        organizationDonations.organizationInternalId,
        organizationInternalId
      ),
    });
  }

  /**
   * Create organization donations (junction records)
   */
  async createMany(data) {
    if (data.length === 0) return [];

    return db.insert(organizationDonations).values(data).returning();
  }

  /**
   * Create a single organization donation
   */
  async create(data) {
    const [orgDonation] = await db
      .insert(organizationDonations)
      .values(data)
      .returning();
    return orgDonation;
  }

  /**
   * Update organization donations for a specific donation
   * (Delete old ones and create new ones)
   */
  async updateForDonation(donationId, data) {
    // Delete existing
    await db
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
  async deleteByDonationId(donationId) {
    await db
      .delete(organizationDonations)
      .where(eq(organizationDonations.donationId, donationId));
  }

  /**
   * Check if an organization has any donations
   */
  async organizationHasDonations(organizationInternalId) {
    const result = await db.query.organizationDonations.findFirst({
      where: eq(
        organizationDonations.organizationInternalId,
        organizationInternalId
      ),
    });
    return !!result;
  }
}

const organizationDonationsRepository = new OrganizationDonationsRepository();

module.exports = {
  OrganizationDonationsRepository,
  organizationDonationsRepository,
};
