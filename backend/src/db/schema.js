'use strict';

const { pgTable, serial, text, varchar, integer, boolean, timestamp, date } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');

// Donors table
const donors = pgTable('donors', {
  id: serial('id').primaryKey(),
  idCode: varchar('id_code', { length: 11 }),
  firstName: varchar('first_name', { length: 128 }),
  lastName: varchar('last_name', { length: 128 }),
  email: varchar('email', { length: 256 }),
  recurringDonor: boolean('recurring_donor').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Recurring donations table (subscription templates)
const recurringDonations = pgTable('recurring_donations', {
  id: serial('id').primaryKey(),
  donorId: integer('donor_id').references(() => donors.id).notNull(),
  active: boolean('active').default(false).notNull(),
  companyName: varchar('company_name', { length: 128 }),
  companyCode: varchar('company_code', { length: 128 }),
  comment: text('comment'),
  bank: varchar('bank', { length: 64 }),
  amount: integer('amount').notNull(), // in cents
  datetime: timestamp('datetime').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Donation transfers table (batch transfer tracking)
const donationTransfers = pgTable('donation_transfers', {
  id: serial('id').primaryKey(),
  datetime: date('datetime').notNull(),
  recipient: varchar('recipient', { length: 256 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Donations table (one-time donations)
const donations = pgTable('donations', {
  id: serial('id').primaryKey(),
  donorId: integer('donor_id').references(() => donors.id), // Can be null for old legacy donations
  recurringDonationId: integer('recurring_donation_id').references(() => recurringDonations.id),
  donationTransferId: integer('donation_transfer_id').references(() => donationTransfers.id),
  datetime: timestamp('datetime').notNull(),
  amount: integer('amount').notNull(), // in cents
  finalized: boolean('finalized').default(false).notNull(),
  paymentMethod: varchar('payment_method', { length: 64 }),
  iban: varchar('iban', { length: 34 }),
  comment: text('comment'),
  companyName: varchar('company_name', { length: 128 }),
  companyCode: varchar('company_code', { length: 128 }),
  sentToOrganization: boolean('sent_to_organization').default(false).notNull(),
  dedicationName: varchar('dedication_name', { length: 128 }),
  dedicationEmail: varchar('dedication_email', { length: 256 }),
  dedicationMessage: text('dedication_message'),
  externalDonation: boolean('external_donation').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Organization donations junction table (splits donations across organizations)
const organizationDonations = pgTable('organization_donations', {
  id: serial('id').primaryKey(),
  donationId: integer('donation_id').references(() => donations.id).notNull(),
  organizationInternalId: varchar('organization_internal_id', { length: 64 }).notNull(), // Links to Strapi organization.internalId
  amount: integer('amount').notNull(), // in cents
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Organization recurring donations junction table
const organizationRecurringDonations = pgTable('organization_recurring_donations', {
  id: serial('id').primaryKey(),
  recurringDonationId: integer('recurring_donation_id').references(() => recurringDonations.id).notNull(),
  organizationInternalId: varchar('organization_internal_id', { length: 64 }).notNull(), // Links to Strapi organization.internalId
  amount: integer('amount').notNull(), // in cents
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations for better query experience
const donorsRelations = relations(donors, ({ many }) => ({
  donations: many(donations),
  recurringDonations: many(recurringDonations),
}));

const donationsRelations = relations(donations, ({ one, many }) => ({
  donor: one(donors, {
    fields: [donations.donorId],
    references: [donors.id],
  }),
  recurringDonation: one(recurringDonations, {
    fields: [donations.recurringDonationId],
    references: [recurringDonations.id],
  }),
  donationTransfer: one(donationTransfers, {
    fields: [donations.donationTransferId],
    references: [donationTransfers.id],
  }),
  organizationDonations: many(organizationDonations),
}));

const recurringDonationsRelations = relations(recurringDonations, ({ one, many }) => ({
  donor: one(donors, {
    fields: [recurringDonations.donorId],
    references: [donors.id],
  }),
  donations: many(donations),
  organizationRecurringDonations: many(organizationRecurringDonations),
}));

const donationTransfersRelations = relations(donationTransfers, ({ many }) => ({
  donations: many(donations),
}));

const organizationDonationsRelations = relations(organizationDonations, ({ one }) => ({
  donation: one(donations, {
    fields: [organizationDonations.donationId],
    references: [donations.id],
  }),
}));

const organizationRecurringDonationsRelations = relations(organizationRecurringDonations, ({ one }) => ({
  recurringDonation: one(recurringDonations, {
    fields: [organizationRecurringDonations.recurringDonationId],
    references: [recurringDonations.id],
  }),
}));

module.exports = {
  donors,
  recurringDonations,
  donationTransfers,
  donations,
  organizationDonations,
  organizationRecurringDonations,
  donorsRelations,
  donationsRelations,
  recurringDonationsRelations,
  donationTransfersRelations,
  organizationDonationsRelations,
  organizationRecurringDonationsRelations,
};
