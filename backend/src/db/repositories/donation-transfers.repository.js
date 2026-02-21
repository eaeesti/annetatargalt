"use strict";

const { eq, desc } = require("drizzle-orm");
const { db } = require("../client");
const { donationTransfers } = require("../schema");

class DonationTransfersRepository {
  /**
   * Find a donation transfer by ID
   */
  async findById(id) {
    return db.query.donationTransfers.findFirst({
      where: eq(donationTransfers.id, id),
    });
  }

  /**
   * Find a donation transfer by ID with related donations
   */
  async findByIdWithDonations(id) {
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
  async findAll(options) {
    return db.query.donationTransfers.findMany({
      orderBy: [desc(donationTransfers.datetime)],
      with: options?.withDonations ? { donations: true } : undefined,
    });
  }

  /**
   * Create a new donation transfer
   */
  async create(data) {
    const [transfer] = await db
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
    return transfer;
  }

  /**
   * Update a donation transfer
   */
  async update(id, data) {
    const updateData = {
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

    const [transfer] = await db
      .update(donationTransfers)
      .set(updateData)
      .where(eq(donationTransfers.id, id))
      .returning();
    return transfer;
  }

  /**
   * Delete a donation transfer (only if no donations are linked)
   */
  async delete(id) {
    await db.delete(donationTransfers).where(eq(donationTransfers.id, id));
  }
}

const donationTransfersRepository = new DonationTransfersRepository();

module.exports = { DonationTransfersRepository, donationTransfersRepository };
