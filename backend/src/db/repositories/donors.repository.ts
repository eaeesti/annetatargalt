import { eq, and, or } from 'drizzle-orm';
import { db } from '../client';
import { donors } from '../schema';

export class DonorsRepository {
  /**
   * Find all donors (for export)
   */
  async findAll() {
    return db.query.donors.findMany({
      orderBy: (donors, { asc }) => [asc(donors.id)],
    });
  }

  /**
   * Find a donor by ID
   */
  async findById(id: number) {
    return db.query.donors.findFirst({
      where: eq(donors.id, id),
    });
  }

  /**
   * Find a donor by ID code
   */
  async findByIdCode(idCode: string) {
    return db.query.donors.findFirst({
      where: eq(donors.idCode, idCode),
    });
  }

  /**
   * Find a donor by email
   */
  async findByEmail(email: string) {
    return db.query.donors.findFirst({
      where: eq(donors.email, email),
    });
  }

  /**
   * Find a donor by ID code or email
   */
  async findByIdCodeOrEmail(idCode: string | null, email: string) {
    if (idCode) {
      return db.query.donors.findFirst({
        where: or(
          eq(donors.idCode, idCode),
          eq(donors.email, email)
        ),
      });
    }
    return this.findByEmail(email);
  }

  /**
   * Create a new donor
   */
  async create(data: {
    idCode?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    recurringDonor?: boolean;
  }) {
    const [donor] = await db.insert(donors).values({
      idCode: data.idCode || null,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      recurringDonor: data.recurringDonor || false,
    }).returning();
    return donor;
  }

  /**
   * Update a donor
   */
  async update(id: number, data: Partial<{
    idCode: string | null;
    firstName: string;
    lastName: string;
    email: string;
    recurringDonor: boolean;
  }>) {
    const [donor] = await db.update(donors)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(donors.id, id))
      .returning();
    return donor;
  }

  /**
   * Mark donor as recurring donor
   */
  async markAsRecurring(id: number) {
    return this.update(id, { recurringDonor: true });
  }

  /**
   * Find or create a donor by ID code or email
   */
  async findOrCreate(data: {
    idCode?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    recurringDonor?: boolean;
  }) {
    const existing = await this.findByIdCodeOrEmail(data.idCode || null, data.email);
    if (existing) {
      return existing;
    }
    return this.create(data);
  }
}

export const donorsRepository = new DonorsRepository();
