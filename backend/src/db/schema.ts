import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Donors table
export const donors = pgTable("donors", {
  id: serial("id").primaryKey(),
  idCode: varchar("id_code", { length: 11 }),
  firstName: varchar("first_name", { length: 128 }),
  lastName: varchar("last_name", { length: 128 }),
  email: varchar("email", { length: 256 }),
  recurringDonor: boolean("recurring_donor").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Recurring donations table (subscription templates)
export const recurringDonations = pgTable("recurring_donations", {
  id: serial("id").primaryKey(),
  donorId: integer("donor_id")
    .references(() => donors.id)
    .notNull(),
  active: boolean("active").default(false).notNull(),
  companyName: varchar("company_name", { length: 128 }),
  companyCode: varchar("company_code", { length: 128 }),
  comment: text("comment"),
  bank: varchar("bank", { length: 64 }),
  amount: integer("amount").notNull(), // in cents
  datetime: timestamp("datetime").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Donation transfers table (batch transfer tracking)
export const donationTransfers = pgTable("donation_transfers", {
  id: serial("id").primaryKey(),
  datetime: date("datetime").notNull(),
  recipient: varchar("recipient", { length: 256 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Donations table (one-time donations)
export const donations = pgTable(
  "donations",
  {
    id: serial("id").primaryKey(),
    donorId: integer("donor_id").references(() => donors.id), // Can be null for old legacy donations
    recurringDonationId: integer("recurring_donation_id").references(
      () => recurringDonations.id,
    ),
    donationTransferId: integer("donation_transfer_id").references(
      () => donationTransfers.id,
    ),
    datetime: timestamp("datetime").notNull(),
    amount: integer("amount").notNull(), // in cents
    finalized: boolean("finalized").default(false).notNull(),
    paymentMethod: varchar("payment_method", { length: 64 }),
    iban: varchar("iban", { length: 34 }),
    comment: text("comment"),
    companyName: varchar("company_name", { length: 128 }),
    companyCode: varchar("company_code", { length: 128 }),
    sentToOrganization: boolean("sent_to_organization")
      .default(false)
      .notNull(),
    // Bank transaction ID (LHV "Arhiveerimistunnus" / archiving code) this donation
    // was reconciled against. Nullable — Montonio payouts land days later; not
    // unique — one bank transfer can cover many donations (batch payouts). FK to
    // bank_transactions.archiving_code (the persistent bank-side ledger).
    transactionId: varchar("transaction_id", { length: 20 }).references(
      () => bankTransactions.archivingCode,
    ),
    // How transactionId was assigned:
    // 'selgitus-id' | 'idcode-amount-date' | 'manual' | 'recurring-import' | 'card-payout'
    transactionMatchSource: varchar("transaction_match_source", { length: 24 }),
    // Per-donation share of a card-payout processor fee (cents), split pro-rata
    // across the payout's batch. Null for non-card / unreconciled donations.
    processorFeeCents: integer("processor_fee_cents"),
    dedicationName: varchar("dedication_name", { length: 128 }),
    dedicationEmail: varchar("dedication_email", { length: 256 }),
    dedicationMessage: text("dedication_message"),
    externalDonation: boolean("external_donation").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("donations_transaction_id_idx").on(table.transactionId)],
);

// Organization donations junction table (splits donations across organizations)
export const organizationDonations = pgTable("organization_donations", {
  id: serial("id").primaryKey(),
  donationId: integer("donation_id")
    .references(() => donations.id)
    .notNull(),
  organizationInternalId: varchar("organization_internal_id", {
    length: 64,
  }).notNull(), // Links to Strapi organization.internalId
  amount: integer("amount").notNull(), // in cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Organization recurring donations junction table
export const organizationRecurringDonations = pgTable(
  "organization_recurring_donations",
  {
    id: serial("id").primaryKey(),
    recurringDonationId: integer("recurring_donation_id")
      .references(() => recurringDonations.id)
      .notNull(),
    organizationInternalId: varchar("organization_internal_id", {
      length: 64,
    }).notNull(), // Links to Strapi organization.internalId
    amount: integer("amount").notNull(), // in cents
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

// Relations for better query experience
export const donorsRelations = relations(donors, ({ many }) => ({
  donations: many(donations),
  recurringDonations: many(recurringDonations),
}));

export const donationsRelations = relations(donations, ({ one, many }) => ({
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
  bankTransaction: one(bankTransactions, {
    fields: [donations.transactionId],
    references: [bankTransactions.archivingCode],
  }),
  organizationDonations: many(organizationDonations),
}));

export const recurringDonationsRelations = relations(
  recurringDonations,
  ({ one, many }) => ({
    donor: one(donors, {
      fields: [recurringDonations.donorId],
      references: [donors.id],
    }),
    donations: many(donations),
    organizationRecurringDonations: many(organizationRecurringDonations),
  }),
);

export const donationTransfersRelations = relations(
  donationTransfers,
  ({ many }) => ({
    donations: many(donations),
  }),
);

export const organizationDonationsRelations = relations(
  organizationDonations,
  ({ one }) => ({
    donation: one(donations, {
      fields: [organizationDonations.donationId],
      references: [donations.id],
    }),
  }),
);

export const organizationRecurringDonationsRelations = relations(
  organizationRecurringDonations,
  ({ one }) => ({
    recurringDonation: one(recurringDonations, {
      fields: [organizationRecurringDonations.recurringDonationId],
      references: [recurringDonations.id],
    }),
  }),
);

// Type exports - Drizzle auto-infers types from schema
export type Donor = typeof donors.$inferSelect;
export type NewDonor = typeof donors.$inferInsert;

export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;

export type RecurringDonation = typeof recurringDonations.$inferSelect;
export type NewRecurringDonation = typeof recurringDonations.$inferInsert;

export type DonationTransfer = typeof donationTransfers.$inferSelect;
export type NewDonationTransfer = typeof donationTransfers.$inferInsert;

export type OrganizationDonation = typeof organizationDonations.$inferSelect;
export type NewOrganizationDonation = typeof organizationDonations.$inferInsert;

export type OrganizationRecurringDonation =
  typeof organizationRecurringDonations.$inferSelect;
export type NewOrganizationRecurringDonation =
  typeof organizationRecurringDonations.$inferInsert;

// Admin audit log — never deleted, append-only
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id", { length: 256 }).notNull(),
  userEmail: varchar("user_email", { length: 256 }).notNull(),
  action: varchar("action", { length: 128 }).notNull(), // e.g. "donations.list", "donors.view"
  recordId: varchar("record_id", { length: 64 }), // ID of the accessed record, if applicable
  ip: varchar("ip", { length: 64 }),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;

// Every credit line ever seen in an imported LHV statement — the persistent
// bank side of the ledger. One row per archiving code. `category` records what
// the operator decided about it; this table also absorbs the old
// `ignored_bank_transactions` ("not a donation") list.
export const bankTransactions = pgTable(
  "bank_transactions",
  {
    archivingCode: varchar("archiving_code", { length: 20 }).primaryKey(),
    // Kuupäev — null until a real statement line is seen (e.g. an ignore added
    // before the line showed up in an export).
    date: date("date"),
    amount: integer("amount"), // cents, credit as it hit the bank
    description: text("description"), // Selgitus
    counterpartyName: varchar("counterparty_name", { length: 256 }),
    counterpartyAccount: varchar("counterparty_account", { length: 64 }),
    senderCode: varchar("sender_code", { length: 64 }), // Isikukood või registrikood
    // 'donation' | 'card-payout' | 'ignored' | 'undecided'
    category: varchar("category", { length: 24 })
      .notNull()
      .default("undecided"),
    // Card-payout rows only: total before the processor fee, and the fee itself
    // (gross_amount - amount). Sourced from the Montonio payout at import time.
    grossAmount: integer("gross_amount"),
    feeAmount: integer("fee_amount"),
    note: varchar("note", { length: 512 }), // ignore reason / free note
    importedAt: timestamp("imported_at").defaultNow().notNull(),
    importedBy: varchar("imported_by", { length: 256 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("bank_transactions_date_idx").on(t.date),
    index("bank_transactions_category_idx").on(t.category),
  ],
);

export type BankTransaction = typeof bankTransactions.$inferSelect;
export type NewBankTransaction = typeof bankTransactions.$inferInsert;

export const bankTransactionsRelations = relations(
  bankTransactions,
  ({ many }) => ({
    donations: many(donations),
  }),
);

// "This bank sender code belongs to this donor" — learned during a statement
// import when the code in the bank line doesn't match any donor/template
// (e.g. a foreign company code). Lets future imports resolve it automatically.
export const senderDonorAliases = pgTable("sender_donor_aliases", {
  senderCode: varchar("sender_code", { length: 64 }).primaryKey(),
  donorId: integer("donor_id")
    .references(() => donors.id)
    .notNull(),
  note: varchar("note", { length: 256 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 256 }),
});

export type SenderDonorAlias = typeof senderDonorAliases.$inferSelect;
export type NewSenderDonorAlias = typeof senderDonorAliases.$inferInsert;
