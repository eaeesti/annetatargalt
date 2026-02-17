'use strict';

const { eq, and, gte, lte, desc, sql, inArray } = require('drizzle-orm');
const { db } = require('../client');
const { donations } = require('../schema');

class DonationsRepository {
  /**
   * Find a donation by ID
   */
  async findById(id) {
    return db.query.donations.findFirst({
      where: eq(donations.id, id),
    });
  }

  /**
   * Find a donation by ID with all relations
   */
  async findByIdWithRelations(id) {
    return db.query.donations.findFirst({
      where: eq(donations.id, id),
      with: {
        donor: true,
        organizationDonations: true,
        recurringDonation: true,
        donationTransfer: true,
      },
    });
  }

  /**
   * Find donations by donor ID
   */
  async findByDonorId(donorId) {
    return db.query.donations.findMany({
      where: eq(donations.donorId, donorId),
      orderBy: [desc(donations.datetime)],
    });
  }

  /**
   * Find finalized donations
   */
  async findFinalized() {
    return db.query.donations.findMany({
      where: eq(donations.finalized, true),
      orderBy: [desc(donations.datetime)],
    });
  }

  /**
   * Find unfinalized donations
   */
  async findUnfinalized() {
    return db.query.donations.findMany({
      where: eq(donations.finalized, false),
      orderBy: [desc(donations.datetime)],
    });
  }

  /**
   * Find all donations (with pagination)
   */
  async findAll(options) {
    return db.query.donations.findMany({
      orderBy: [desc(donations.datetime)],
      limit: options?.limit,
      offset: options?.offset,
      with: {
        donor: true,
        organizationDonations: true,
      },
    });
  }

  /**
   * Find donation by transaction details (for matching bank transactions)
   */
  async findByTransaction(params) {
    const dateFrom =
      typeof params.dateFrom === 'string'
        ? new Date(params.dateFrom)
        : params.dateFrom;
    const dateTo =
      typeof params.dateTo === 'string'
        ? new Date(params.dateTo)
        : params.dateTo;

    // Find donations matching amount and date range
    const matchingDonations = await db.query.donations.findMany({
      where: and(
        eq(donations.amount, params.amount),
        gte(donations.datetime, dateFrom),
        lte(donations.datetime, dateTo)
      ),
      with: {
        donor: true,
      },
    });

    // If idCode provided, filter by donor's idCode
    if (params.idCode) {
      return matchingDonations.filter((d) => d.donor?.idCode === params.idCode);
    }

    return matchingDonations;
  }

  /**
   * Create a new donation
   */
  async create(data) {
    const [donation] = await db
      .insert(donations)
      .values({
        donorId: data.donorId,
        amount: data.amount,
        datetime:
          typeof data.datetime === 'string'
            ? new Date(data.datetime)
            : data.datetime,
        finalized: data.finalized !== undefined ? data.finalized : false,
        paymentMethod: data.paymentMethod || null,
        iban: data.iban || null,
        comment: data.comment || null,
        companyName: data.companyName || null,
        companyCode: data.companyCode || null,
        sentToOrganization:
          data.sentToOrganization !== undefined
            ? data.sentToOrganization
            : false,
        dedicationName: data.dedicationName || null,
        dedicationEmail: data.dedicationEmail || null,
        dedicationMessage: data.dedicationMessage || null,
        externalDonation:
          data.externalDonation !== undefined ? data.externalDonation : false,
        recurringDonationId: data.recurringDonationId || null,
        donationTransferId: data.donationTransferId || null,
      })
      .returning();
    return donation;
  }

  /**
   * Update a donation
   */
  async update(id, data) {
    const [donation] = await db
      .update(donations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(donations.id, id))
      .returning();
    return donation;
  }

  /**
   * Finalize a donation (mark as completed)
   */
  async finalize(id) {
    return this.update(id, { finalized: true });
  }

  /**
   * Mark donations as sent to organization
   */
  async markAsSentToOrganization(ids) {
    if (ids.length === 0) return [];

    return db
      .update(donations)
      .set({
        sentToOrganization: true,
        updatedAt: new Date(),
      })
      .where(inArray(donations.id, ids))
      .returning();
  }

  /**
   * Add donations to a transfer batch
   */
  async addToTransfer(donationIds, transferId) {
    if (donationIds.length === 0) return [];

    return db
      .update(donations)
      .set({
        donationTransferId: transferId,
        updatedAt: new Date(),
      })
      .where(inArray(donations.id, donationIds))
      .returning();
  }

  /**
   * Sum of all finalized donations (excluding external donations and tips)
   * This is used for statistics
   */
  async sumFinalizedDonations(params) {
    // Build the WHERE conditions
    const conditions = [eq(donations.finalized, true)];

    if (params?.externalDonation !== undefined) {
      conditions.push(eq(donations.externalDonation, params.externalDonation));
    }

    // Get all matching donations
    const matchingDonations = await db.query.donations.findMany({
      where: and(...conditions),
      with: {
        organizationDonations: true,
      },
    });

    // If we need to exclude specific organizations, sum only the amounts
    // that don't go to those organizations
    if (
      params?.excludeOrganizationInternalIds &&
      params.excludeOrganizationInternalIds.length > 0
    ) {
      let total = 0;
      for (const donation of matchingDonations) {
        const orgDonationsFiltered = donation.organizationDonations.filter(
          (od) =>
            !params.excludeOrganizationInternalIds.includes(
              od.organizationInternalId
            )
        );
        total += orgDonationsFiltered.reduce((sum, od) => sum + od.amount, 0);
      }
      return total;
    }

    // Otherwise, sum all donation amounts
    return matchingDonations.reduce((sum, d) => sum + d.amount, 0);
  }

  /**
   * Sum of finalized donations within a date range (for campaigns)
   */
  async sumFinalizedDonationsInRange(params) {
    const dateFrom =
      typeof params.dateFrom === 'string'
        ? new Date(params.dateFrom)
        : params.dateFrom;
    const dateTo =
      typeof params.dateTo === 'string'
        ? new Date(params.dateTo)
        : params.dateTo;

    const conditions = [
      eq(donations.finalized, true),
      gte(donations.datetime, dateFrom),
      lte(donations.datetime, dateTo),
    ];

    if (params.externalDonation !== undefined) {
      conditions.push(eq(donations.externalDonation, params.externalDonation));
    }

    const matchingDonations = await db.query.donations.findMany({
      where: and(...conditions),
      with: {
        organizationDonations: true,
      },
    });

    if (
      params.excludeOrganizationInternalIds &&
      params.excludeOrganizationInternalIds.length > 0
    ) {
      let total = 0;
      for (const donation of matchingDonations) {
        const orgDonationsFiltered = donation.organizationDonations.filter(
          (od) =>
            !params.excludeOrganizationInternalIds.includes(
              od.organizationInternalId
            )
        );
        total += orgDonationsFiltered.reduce((sum, od) => sum + od.amount, 0);
      }
      return total;
    }

    return matchingDonations.reduce((sum, d) => sum + d.amount, 0);
  }

  /**
   * Count total donations
   */
  async count() {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(donations);
    return Number(result[0].count);
  }

  /**
   * Count finalized donations
   */
  async countFinalized() {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(donations)
      .where(eq(donations.finalized, true));
    return Number(result[0].count);
  }

  /**
   * Delete a donation (and its organization_donations via cascade)
   */
  async delete(id) {
    await db.delete(donations).where(eq(donations.id, id));
  }

  /**
   * Find donations by date range
   */
  async findByDateRange(dateFrom, dateTo) {
    const from = typeof dateFrom === 'string' ? new Date(dateFrom) : dateFrom;
    const to = typeof dateTo === 'string' ? new Date(dateTo) : dateTo;

    return db.query.donations.findMany({
      where: and(gte(donations.datetime, from), lte(donations.datetime, to)),
      orderBy: [desc(donations.datetime)],
      with: {
        donor: true,
        organizationDonations: true,
      },
    });
  }

  /**
   * Find donations not yet sent to organizations
   */
  async findNotSentToOrganization() {
    return db.query.donations.findMany({
      where: and(
        eq(donations.finalized, true),
        eq(donations.sentToOrganization, false)
      ),
      orderBy: [desc(donations.datetime)],
      with: {
        donor: true,
        organizationDonations: true,
      },
    });
  }
}

const donationsRepository = new DonationsRepository();

module.exports = { DonationsRepository, donationsRepository };
