import { eq, or } from "drizzle-orm";
import { db, type Database } from "../client";
import { donors, type Donor, type NewDonor } from "../schema";

export class DonorsRepository {
  constructor(private database: Database = db) {}

  /**
   * Find all donors (for export)
   */
  async findAll(): Promise<Donor[]> {
    return this.database.query.donors.findMany({
      orderBy: (donors, { asc }) => [asc(donors.id)],
    });
  }

  /**
   * Find a donor by ID
   */
  async findById(id: number): Promise<Donor | undefined> {
    return this.database.query.donors.findFirst({
      where: eq(donors.id, id),
    });
  }

  /**
   * Find a donor by ID code
   */
  async findByIdCode(idCode: string): Promise<Donor | undefined> {
    return this.database.query.donors.findFirst({
      where: eq(donors.idCode, idCode),
    });
  }

  /**
   * Find a donor by email
   */
  async findByEmail(email: string): Promise<Donor | undefined> {
    return this.database.query.donors.findFirst({
      where: eq(donors.email, email),
    });
  }

  /**
   * Find a donor by ID code or email
   */
  async findByIdCodeOrEmail(
    idCode: string | null,
    email: string
  ): Promise<Donor | undefined> {
    if (idCode) {
      return this.database.query.donors.findFirst({
        where: or(eq(donors.idCode, idCode), eq(donors.email, email)),
      });
    }
    return this.findByEmail(email);
  }

  /**
   * Create a new donor
   */
  async create(data: Partial<NewDonor> & { email: string }): Promise<Donor> {
    const [donor] = await this.database
      .insert(donors)
      .values({
        idCode: data.idCode || null,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email,
        recurringDonor: data.recurringDonor || false,
      })
      .returning();
    return donor!;
  }

  /**
   * Update a donor
   */
  async update(id: number, data: Partial<NewDonor>): Promise<Donor | undefined> {
    const [donor] = await this.database
      .update(donors)
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
  async markAsRecurring(id: number): Promise<Donor | undefined> {
    return this.update(id, { recurringDonor: true });
  }

  /**
   * Find or create a donor by ID code or email
   */
  async findOrCreate(data: Partial<NewDonor> & { email: string }): Promise<Donor> {
    const existing = await this.findByIdCodeOrEmail(
      data.idCode || null,
      data.email
    );
    if (existing) {
      return existing;
    }
    return this.create(data);
  }
}

export const donorsRepository = new DonorsRepository();
