'use strict';

const { eq, and, desc } = require('drizzle-orm');
const { db } = require('../client');
const { recurringDonations } = require('../schema');

class RecurringDonationsRepository {
  /**
   * Find all recurring donations (for export)
   */
  async findAll() {
    return db.query.recurringDonations.findMany({
      orderBy: (recurringDonations, { asc }) => [asc(recurringDonations.id)],
      with: {
        donor: true,
      },
    });
  }

  /**
   * Find a recurring donation by ID
   */
  async findById(id) {
    return db.query.recurringDonations.findFirst({
      where: eq(recurringDonations.id, id),
    });
  }

  /**
   * Find a recurring donation by ID with related data
   */
  async findByIdWithRelations(id) {
    return db.query.recurringDonations.findFirst({
      where: eq(recurringDonations.id, id),
      with: {
        donor: true,
        organizationRecurringDonations: true,
        donations: true,
      },
    });
  }

  /**
   * Find recurring donations by donor ID
   */
  async findByDonorId(donorId) {
    return db.query.recurringDonations.findMany({
      where: eq(recurringDonations.donorId, donorId),
      orderBy: [desc(recurringDonations.datetime)],
    });
  }

  /**
   * Find active recurring donations
   */
  async findActive() {
    return db.query.recurringDonations.findMany({
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
  async findActiveByDonorId(donorId) {
    return db.query.recurringDonations.findMany({
      where: and(
        eq(recurringDonations.donorId, donorId),
        eq(recurringDonations.active, true)
      ),
      orderBy: [desc(recurringDonations.datetime)],
    });
  }

  /**
   * Find recurring donation by company code
   */
  async findByCompanyCode(companyCode) {
    return db.query.recurringDonations.findFirst({
      where: eq(recurringDonations.companyCode, companyCode),
      orderBy: [desc(recurringDonations.datetime)],
    });
  }

  /**
   * Create a new recurring donation
   */
  async create(data) {
    const [recurringDonation] = await db.insert(recurringDonations).values({
      donorId: data.donorId,
      amount: data.amount,
      active: data.active !== undefined ? data.active : true,
      companyName: data.companyName || null,
      companyCode: data.companyCode || null,
      comment: data.comment || null,
      bank: data.bank || null,
      datetime: typeof data.datetime === 'string' ? new Date(data.datetime) : data.datetime,
    }).returning();
    return recurringDonation;
  }

  /**
   * Update a recurring donation
   */
  async update(id, data) {
    const [recurringDonation] = await db.update(recurringDonations)
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
  async deactivate(id) {
    return this.update(id, { active: false });
  }

  /**
   * Activate a recurring donation
   */
  async activate(id) {
    return this.update(id, { active: true });
  }

  /**
   * Delete a recurring donation
   */
  async delete(id) {
    await db.delete(recurringDonations)
      .where(eq(recurringDonations.id, id));
  }
}

const recurringDonationsRepository = new RecurringDonationsRepository();

module.exports = { RecurringDonationsRepository, recurringDonationsRepository };
