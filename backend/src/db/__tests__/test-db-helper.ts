/**
 * Test Database Helper
 *
 * Provides utilities for setting up and tearing down test database state.
 * Uses the same Drizzle database as the app (configured via env vars).
 */

import { db } from "../client";
import {
  donors,
  donations,
  organizationDonations,
  recurringDonations,
  organizationRecurringDonations,
  donationTransfers,
  type Donor,
  type NewDonor,
  type Donation,
  type NewDonation,
  type OrganizationDonation,
  type NewOrganizationDonation,
  type RecurringDonation,
  type NewRecurringDonation,
  type OrganizationRecurringDonation,
  type NewOrganizationRecurringDonation,
  type DonationTransfer,
  type NewDonationTransfer,
} from "../schema";
import { sql } from "drizzle-orm";

/**
 * Clean all test data from the database
 * WARNING: This will delete ALL data in the donations database
 */
export async function cleanDatabase(): Promise<void> {
  // Delete in correct order to respect foreign key constraints
  await db.delete(organizationDonations);
  await db.delete(donations);
  await db.delete(organizationRecurringDonations);
  await db.delete(recurringDonations);
  await db.delete(donationTransfers);
  await db.delete(donors);
}

/**
 * Reset auto-increment sequences (optional, for predictable IDs in tests)
 */
export async function resetSequences(): Promise<void> {
  await db.execute(sql`ALTER SEQUENCE donors_id_seq RESTART WITH 1`);
  await db.execute(sql`ALTER SEQUENCE donations_id_seq RESTART WITH 1`);
  await db.execute(
    sql`ALTER SEQUENCE organization_donations_id_seq RESTART WITH 1`
  );
  await db.execute(
    sql`ALTER SEQUENCE recurring_donations_id_seq RESTART WITH 1`
  );
  await db.execute(
    sql`ALTER SEQUENCE organization_recurring_donations_id_seq RESTART WITH 1`
  );
  await db.execute(
    sql`ALTER SEQUENCE donation_transfers_id_seq RESTART WITH 1`
  );
}

/**
 * Create a test donor
 */
export async function createTestDonor(data: Partial<NewDonor> = {}): Promise<Donor> {
  const [donor] = await db
    .insert(donors)
    .values({
      idCode: data.idCode || "38207162722",
      firstName: data.firstName || "Test",
      lastName: data.lastName || "Donor",
      email: data.email || "test@example.com",
      ...data,
    })
    .returning();
  if (!donor) throw new Error("Failed to insert test donor");
  return donor;
}

/**
 * Create a test donation
 */
export async function createTestDonation(data: Partial<NewDonation> = {}): Promise<Donation> {
  const [donation] = await db
    .insert(donations)
    .values({
      donorId: data.donorId ?? null,
      amount: data.amount ?? 1000, // 10.00 EUR in cents
      datetime: data.datetime ?? new Date(),
      finalized: data.finalized !== undefined ? data.finalized : true,
      paymentMethod: data.paymentMethod ?? null,
      iban: data.iban ?? null,
      comment: data.comment ?? null,
      companyName: data.companyName ?? null,
      companyCode: data.companyCode ?? null,
      sentToOrganization:
        data.sentToOrganization !== undefined ? data.sentToOrganization : false,
      dedicationName: data.dedicationName ?? null,
      dedicationEmail: data.dedicationEmail ?? null,
      dedicationMessage: data.dedicationMessage ?? null,
      externalDonation:
        data.externalDonation !== undefined ? data.externalDonation : false,
      recurringDonationId: data.recurringDonationId ?? null,
      donationTransferId: data.donationTransferId ?? null,
    })
    .returning();
  if (!donation) throw new Error("Failed to insert test donation");
  return donation;
}

/**
 * Create a test organization donation (junction record)
 */
export async function createTestOrganizationDonation(
  data: NewOrganizationDonation
): Promise<OrganizationDonation> {
  const [orgDonation] = await db
    .insert(organizationDonations)
    .values({
      donationId: data.donationId,
      organizationInternalId: data.organizationInternalId,
      amount: data.amount,
    })
    .returning();
  if (!orgDonation) throw new Error("Failed to insert test organization donation");
  return orgDonation;
}

/**
 * Create a test recurring donation
 */
export async function createTestRecurringDonation(
  data: Partial<NewRecurringDonation> & { donorId: number }
): Promise<RecurringDonation> {
  const [recurringDonation] = await db
    .insert(recurringDonations)
    .values({
      donorId: data.donorId,
      amount: data.amount ?? 1000,
      active: data.active !== undefined ? data.active : true,
      companyName: data.companyName ?? null,
      companyCode: data.companyCode ?? null,
      comment: data.comment ?? null,
      bank: data.bank ?? null,
      datetime: data.datetime ?? new Date(),
    })
    .returning();
  if (!recurringDonation) throw new Error("Failed to insert test recurring donation");
  return recurringDonation;
}

/**
 * Create a test organization recurring donation (junction record)
 */
export async function createTestOrganizationRecurringDonation(
  data: NewOrganizationRecurringDonation
): Promise<OrganizationRecurringDonation> {
  const [orgRecurringDonation] = await db
    .insert(organizationRecurringDonations)
    .values({
      recurringDonationId: data.recurringDonationId,
      organizationInternalId: data.organizationInternalId,
      amount: data.amount,
    })
    .returning();
  if (!orgRecurringDonation) throw new Error("Failed to insert test organization recurring donation");
  return orgRecurringDonation;
}

/**
 * Create a test donation transfer
 */
export async function createTestDonationTransfer(
  data: Partial<NewDonationTransfer> = {}
): Promise<DonationTransfer> {
  const [transfer] = await db
    .insert(donationTransfers)
    .values({
      datetime: data.datetime ?? new Date().toISOString().split('T')[0],
      recipient: data.recipient ?? "Test Recipient",
      notes: data.notes ?? null,
    })
    .returning();
  if (!transfer) throw new Error("Failed to insert test donation transfer");
  return transfer;
}
