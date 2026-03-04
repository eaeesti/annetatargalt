import { eq, desc } from "drizzle-orm";
import { db, type Database } from "../client";
import { donationTransfers, type DonationTransfer, type NewDonationTransfer } from "../schema";

interface FindAllOptions {
  withDonations?: boolean;
}

export class DonationTransfersRepository {
  constructor(private database: Database = db) {}

  /**
   * Find a donation transfer by ID
   */
  async findById(id: number): Promise<DonationTransfer | undefined> {
    return this.database.query.donationTransfers.findFirst({
      where: eq(donationTransfers.id, id),
    });
  }

  /**
   * Find a donation transfer by ID with related donations
   */
  async findByIdWithDonations(id: number) {
    return this.database.query.donationTransfers.findFirst({
      where: eq(donationTransfers.id, id),
      with: {
        donations: true,
      },
    });
  }

  /**
   * Get all donation transfers, ordered by date (newest first)
   */
  async findAll(options?: FindAllOptions) {
    return this.database.query.donationTransfers.findMany({
      orderBy: [desc(donationTransfers.datetime)],
      with: options?.withDonations ? { donations: true } : undefined,
    });
  }

  /**
   * Create a new donation transfer
   */
  async create(data: Omit<NewDonationTransfer, 'datetime'> & { datetime: string | Date }): Promise<DonationTransfer> {
    const [transfer] = await this.database
      .insert(donationTransfers)
      .values({
        datetime:
          typeof data.datetime === "string"
            ? data.datetime
            : data.datetime.toISOString().split("T")[0], // Convert Date to YYYY-MM-DD
        recipient: data.recipient || null,
        notes: data.notes || null,
      })
      .returning();
    return transfer!;
  }

  /**
   * Update a donation transfer
   */
  async update(
    id: number,
    data: Partial<Omit<NewDonationTransfer, 'datetime'>> & { datetime?: string | Date }
  ): Promise<DonationTransfer | undefined> {
    const updateData: Partial<NewDonationTransfer> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    // Only include fields that are provided
    if (data.recipient !== undefined) updateData.recipient = data.recipient;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.datetime) {
      updateData.datetime =
        typeof data.datetime === "string"
          ? data.datetime
          : data.datetime.toISOString().split("T")[0]; // Convert Date to YYYY-MM-DD
    }

    const [transfer] = await this.database
      .update(donationTransfers)
      .set(updateData)
      .where(eq(donationTransfers.id, id))
      .returning();
    return transfer;
  }

  /**
   * Delete a donation transfer (only if no donations are linked)
   */
  async delete(id: number): Promise<void> {
    await this.database.delete(donationTransfers).where(eq(donationTransfers.id, id));
  }
}

export const donationTransfersRepository = new DonationTransfersRepository();
