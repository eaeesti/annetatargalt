import { eq, and, desc } from 'drizzle-orm';
import { db } from '../client';
import { recurringDonations } from '../schema';

export class RecurringDonationsRepository {
  /**
   * Find a recurring donation by ID
   */
  async findById(id: number) {
    return db.query.recurringDonations.findFirst({
      where: eq(recurringDonations.id, id),
    });
  }

  /**
   * Find a recurring donation by ID with related data
   */
  async findByIdWithRelations(id: number) {
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
  async findByDonorId(donorId: number) {
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
  async findActiveByDonorId(donorId: number) {
    return db.query.recurringDonations.findMany({
      where: and(
        eq(recurringDonations.donorId, donorId),
        eq(recurringDonations.active, true)
      ),
      orderBy: [desc(recurringDonations.datetime)],
    });
  }

  /**
   * Create a new recurring donation
   */
  async create(data: {
    donorId: number;
    amount: number;
    active?: boolean;
    companyName?: string | null;
    companyCode?: string | null;
    comment?: string | null;
    bank?: string | null;
    datetime: Date | string;
  }) {
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
  async update(id: number, data: Partial<{
    active: boolean;
    companyName: string | null;
    companyCode: string | null;
    comment: string | null;
    bank: string | null;
    amount: number;
  }>) {
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
  async deactivate(id: number) {
    return this.update(id, { active: false });
  }

  /**
   * Activate a recurring donation
   */
  async activate(id: number) {
    return this.update(id, { active: true });
  }

  /**
   * Delete a recurring donation
   */
  async delete(id: number) {
    await db.delete(recurringDonations)
      .where(eq(recurringDonations.id, id));
  }
}

export const recurringDonationsRepository = new RecurringDonationsRepository();
