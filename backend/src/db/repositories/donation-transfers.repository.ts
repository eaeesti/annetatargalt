import { eq, desc } from 'drizzle-orm';
import { db } from '../client';
import { donationTransfers } from '../schema';

export class DonationTransfersRepository {
  /**
   * Find a donation transfer by ID
   */
  async findById(id: number) {
    return db.query.donationTransfers.findFirst({
      where: eq(donationTransfers.id, id),
    });
  }

  /**
   * Find a donation transfer by ID with related donations
   */
  async findByIdWithDonations(id: number) {
    return db.query.donationTransfers.findFirst({
      where: eq(donationTransfers.id, id),
      with: {
        donations: true,
      },
    });
  }

  /**
   * Get all donation transfers, ordered by date (newest first)
   */
  async findAll() {
    return db.query.donationTransfers.findMany({
      orderBy: [desc(donationTransfers.datetime)],
    });
  }

  /**
   * Create a new donation transfer
   */
  async create(data: {
    datetime: Date | string;
    recipient?: string | null;
    notes?: string | null;
  }) {
    const [transfer] = await db.insert(donationTransfers).values({
      datetime: typeof data.datetime === 'string'
        ? data.datetime
        : data.datetime.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD
      recipient: data.recipient || null,
      notes: data.notes || null,
    }).returning();
    return transfer;
  }

  /**
   * Update a donation transfer
   */
  async update(id: number, data: Partial<{
    datetime: Date | string;
    recipient: string | null;
    notes: string | null;
  }>) {
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Only include fields that are provided
    if (data.recipient !== undefined) updateData.recipient = data.recipient;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.datetime) {
      updateData.datetime = typeof data.datetime === 'string'
        ? data.datetime
        : data.datetime.toISOString().split('T')[0]; // Convert Date to YYYY-MM-DD
    }

    const [transfer] = await db.update(donationTransfers)
      .set(updateData)
      .where(eq(donationTransfers.id, id))
      .returning();
    return transfer;
  }

  /**
   * Delete a donation transfer (only if no donations are linked)
   */
  async delete(id: number) {
    await db.delete(donationTransfers)
      .where(eq(donationTransfers.id, id));
  }
}

export const donationTransfersRepository = new DonationTransfersRepository();
