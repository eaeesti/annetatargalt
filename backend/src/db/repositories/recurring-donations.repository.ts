import { eq, and, desc } from "drizzle-orm";
import { db, type Database } from "../client";
import { recurringDonations, type RecurringDonation, type NewRecurringDonation } from "../schema";

export class RecurringDonationsRepository {
  constructor(private database: Database = db) {}

  /**
   * Find all recurring donations (for export)
   */
  async findAll() {
    return this.database.query.recurringDonations.findMany({
      orderBy: (recurringDonations, { asc }) => [asc(recurringDonations.id)],
      with: {
        donor: true,
      },
    });
  }

  /**
   * Find a recurring donation by ID
   */
  async findById(id: number): Promise<RecurringDonation | undefined> {
    return this.database.query.recurringDonations.findFirst({
      where: eq(recurringDonations.id, id),
    });
  }

  /**
   * Find a recurring donation by ID with related data
   */
  async findByIdWithRelations(id: number) {
    return this.database.query.recurringDonations.findFirst({
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
  async findByDonorId(donorId: number): Promise<RecurringDonation[]> {
    return this.database.query.recurringDonations.findMany({
      where: eq(recurringDonations.donorId, donorId),
      orderBy: [desc(recurringDonations.datetime)],
    });
  }

  /**
   * Find active recurring donations
   */
  async findActive() {
    return this.database.query.recurringDonations.findMany({
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
  async findActiveByDonorId(donorId: number): Promise<RecurringDonation[]> {
    return this.database.query.recurringDonations.findMany({
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
  async findByCompanyCode(companyCode: string): Promise<RecurringDonation | undefined> {
    return this.database.query.recurringDonations.findFirst({
      where: eq(recurringDonations.companyCode, companyCode),
      orderBy: [desc(recurringDonations.datetime)],
    });
  }

  /**
   * Create a new recurring donation
   */
  async create(data: NewRecurringDonation & { datetime?: string | Date }): Promise<RecurringDonation> {
    const [recurringDonation] = await this.database
      .insert(recurringDonations)
      .values({
        donorId: data.donorId,
        amount: data.amount,
        active: data.active !== undefined ? data.active : true,
        companyName: data.companyName || null,
        companyCode: data.companyCode || null,
        comment: data.comment || null,
        bank: data.bank || null,
        datetime:
          typeof data.datetime === "string"
            ? new Date(data.datetime)
            : data.datetime ?? new Date(),
      })
      .returning();
    return recurringDonation!;
  }

  /**
   * Update a recurring donation
   */
  async update(id: number, data: Partial<NewRecurringDonation>): Promise<RecurringDonation | undefined> {
    const [recurringDonation] = await this.database
      .update(recurringDonations)
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
  async deactivate(id: number): Promise<RecurringDonation | undefined> {
    return this.update(id, { active: false });
  }

  /**
   * Activate a recurring donation
   */
  async activate(id: number): Promise<RecurringDonation | undefined> {
    return this.update(id, { active: true });
  }

  /**
   * Delete a recurring donation
   */
  async delete(id: number): Promise<void> {
    await this.database.delete(recurringDonations).where(eq(recurringDonations.id, id));
  }
}

export const recurringDonationsRepository = new RecurringDonationsRepository();
