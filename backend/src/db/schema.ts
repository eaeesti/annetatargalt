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
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { addressOf } from "../utils/address";
import type { AudienceFilters, CampaignContent } from "../utils/email-campaign";

// Donors table
export const donors = pgTable(
  "donors",
  {
    id: serial("id").primaryKey(),
    idCode: varchar("id_code", { length: 11 }),
    firstName: varchar("first_name", { length: 128 }),
    lastName: varchar("last_name", { length: 128 }),
    email: varchar("email", { length: 256 }),
    // The emails the donor gets besides the confirmations of their donations.
    // Each of them links to a page where the donor can change these.
    newsletter: boolean("newsletter").default(true).notNull(),
    transferEmails: boolean("transfer_emails").default(true).notNull(),
    yearlyEmails: boolean("yearly_emails").default(true).notNull(),
    // Who last set the newsletter setting: "existing-donor" for everyone who
    // had given before there was a newsletter, "default" for everyone else
    // until it's set, "donation" for a donation form's choice, "settings" for
    // the donor on their settings page or with an email's unsubscribe button,
    // or the team at their request. A donation can't turn back on what was
    // turned off in the settings.
    newsletterSource: varchar("newsletter_source", { length: 24 })
      .default("default")
      .notNull(),
    // When the donor last changed what they get, if ever.
    emailPreferencesUpdatedAt: timestamp("email_preferences_updated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // The rows of one address, as the emails find them (utils/address.ts)
    index("donors_address_idx").on(addressOf(t.email)),
  ],
);

// Recurring donations table (subscription templates)
export const recurringDonations = pgTable(
  "recurring_donations",
  {
    id: serial("id").primaryKey(),
    donorId: integer("donor_id")
      .references(() => donors.id)
      .notNull(),
    companyName: varchar("company_name", { length: 128 }),
    companyCode: varchar("company_code", { length: 128 }),
    comment: text("comment"),
    bank: varchar("bank", { length: 64 }),
    amount: integer("amount").notNull(), // in cents
    // The site language the donor set it up in: its emails go out in it.
    locale: varchar("locale", { length: 8 }).default("et").notNull(),
    // A "yes" to the newsletter made with the standing order, waiting for
    // its first payment: filling in the form, which anyone can do with any
    // address, signs no one up by itself. Null once it has counted or been
    // overruled, and when the donor said no, which counted at once, or the
    // form didn't ask.
    newsletter: boolean("newsletter"),
    datetime: timestamp("datetime").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("recurring_donations_donor_idx").on(t.donorId)],
);

// Donation transfers table (batch transfer tracking)
export const donationTransfers = pgTable("donation_transfers", {
  id: serial("id").primaryKey(),
  datetime: date("datetime").notNull(),
  recipient: varchar("recipient", { length: 256 }),
  notes: text("notes"),
  // Reconciliation escape hatch for messy historical rounds: the amount of
  // `owed` that legitimately did NOT leave via a linked outgoing debit —
  // a payout the imported statements don't cover, or absorbed fees. Signed:
  // negative when a linked debit over-covers this round. NULL = not assessed.
  reconciliationAdjustmentCents: integer("reconciliation_adjustment_cents"),
  reconciliationNote: text("reconciliation_note"),
  // Card processors keep their fee from each payout, so the round's card fees
  // come off the tip organization's share instead of everyone's: everyone
  // else receives their full amount. Off for rounds from before the rule.
  deductCardFees: boolean("deduct_card_fees").default(false).notNull(),
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
    // The site language the donor gave in: the payment page, the page they
    // return to and their emails are all in it.
    locale: varchar("locale", { length: 8 }).default("et").notNull(),
    // Whether the donor asked for the newsletter with this donation; null when
    // the form didn't ask. A "no" counted when the donation was made; a "yes"
    // counts when it's paid, so an abandoned payment signs no one up.
    newsletter: boolean("newsletter"),
    // What the payment provider last reported about the payment: "PAID", or
    // one that didn't go through, such as "ABANDONED". Null when it never
    // reported, as for donations from before this was kept.
    paymentStatus: varchar("payment_status", { length: 32 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("donations_transaction_id_idx").on(table.transactionId),
    // Postgres doesn't index FK columns automatically. Without these, every
    // relational fetch (a donor's donations, a transfer's donations) and every
    // recurring-activity subquery seq-scans the whole table.
    index("donations_donor_idx").on(table.donorId),
    index("donations_recurring_donation_idx").on(table.recurringDonationId),
    index("donations_donation_transfer_idx").on(table.donationTransferId),
    // Default sort + every date-range filter on the donations list.
    index("donations_datetime_idx").on(table.datetime),
  ],
);

// Organization donations junction table (splits donations across organizations)
export const organizationDonations = pgTable(
  "organization_donations",
  {
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
  },
  // Every donations-list row pulls its org split through this FK — unindexed,
  // that lateral join seq-scans this whole table once per donation.
  (t) => [index("organization_donations_donation_idx").on(t.donationId)],
);

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
  (t) => [
    index("org_recurring_donations_recurring_idx").on(t.recurringDonationId),
  ],
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
    bankTransactions: many(bankTransactions),
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
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: serial("id").primaryKey(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    userId: varchar("user_id", { length: 256 }).notNull(),
    userEmail: varchar("user_email", { length: 256 }).notNull(),
    action: varchar("action", { length: 128 }).notNull(), // e.g. "donations.list", "donors.view"
    recordId: varchar("record_id", { length: 64 }), // ID of the accessed record, if applicable
    ip: varchar("ip", { length: 64 }),
  },
  (t) => [
    // Whether an action was logged lately reads only the latest entries
    // (repositories/adminAuditLog.repository.ts).
    index("admin_audit_log_timestamp_idx").on(t.timestamp),
  ],
);

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
    amount: integer("amount"), // cents, always positive: see direction
    // 'C' money in, 'D' money out, from the statement's Deebet/Kreedit column.
    // Null for a row no import has filled in yet: the category of a reclassified
    // line doesn't say which way its money went.
    direction: varchar("direction", { length: 1 }),
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
    // Outgoing (debit) rows only: the transfer round this payment was part of.
    // Set from the /transfers admin view or the backfill script.
    donationTransferId: integer("donation_transfer_id").references(
      () => donationTransfers.id,
    ),
    importedAt: timestamp("imported_at").defaultNow().notNull(),
    importedBy: varchar("imported_by", { length: 256 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("bank_transactions_date_idx").on(t.date),
    index("bank_transactions_category_idx").on(t.category),
    index("bank_transactions_donation_transfer_idx").on(t.donationTransferId),
  ],
);

export type BankTransaction = typeof bankTransactions.$inferSelect;
export type NewBankTransaction = typeof bankTransactions.$inferInsert;

export const bankTransactionsRelations = relations(
  bankTransactions,
  ({ one, many }) => ({
    donations: many(donations),
    donationTransfer: one(donationTransfers, {
      fields: [bankTransactions.donationTransferId],
      references: [donationTransfers.id],
    }),
    file: one(bankTransactionFiles),
  }),
);

// The PDF attached to a bank line, such as a recipient's receipt for a
// transfer payment; a line has at most one. The file itself is on the
// server's disk (src/utils/file-storage.ts) under `storage_key`; this row is
// all the database knows about it.
export const bankTransactionFiles = pgTable("bank_transaction_files", {
  id: serial("id").primaryKey(),
  archivingCode: varchar("archiving_code", { length: 20 })
    .references(() => bankTransactions.archivingCode)
    .notNull()
    .unique(),
  storageKey: varchar("storage_key", { length: 64 }).notNull().unique(),
  fileName: varchar("file_name", { length: 255 }).notNull(), // as uploaded
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: varchar("uploaded_by", { length: 256 }),
});

export type BankTransactionFile = typeof bankTransactionFiles.$inferSelect;
export type NewBankTransactionFile = typeof bankTransactionFiles.$inferInsert;

export const bankTransactionFilesRelations = relations(
  bankTransactionFiles,
  ({ one }) => ({
    bankTransaction: one(bankTransactions, {
      fields: [bankTransactionFiles.archivingCode],
      references: [bankTransactions.archivingCode],
    }),
  }),
);

// "This bank sender code belongs to this donor" — learned during a statement
// import when the code in the bank line doesn't match any donor/template
// (e.g. a foreign company code). Lets future imports resolve it automatically.
export const senderDonorAliases = pgTable(
  "sender_donor_aliases",
  {
    senderCode: varchar("sender_code", { length: 64 }).primaryKey(),
    donorId: integer("donor_id")
      .references(() => donors.id)
      .notNull(),
    note: varchar("note", { length: 256 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 256 }),
  },
  (t) => [index("sender_donor_aliases_donor_idx").on(t.donorId)],
);

export type SenderDonorAlias = typeof senderDonorAliases.$inferSelect;
export type NewSenderDonorAlias = typeof senderDonorAliases.$inferInsert;

// An email the team writes in the admin panel and sends to a group of donors:
// a newsletter, the news that a round's donations were passed on, or a year's
// summary. Each donor's copy is a row in email_sends, under the email's id.
export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  // 'newsletter' | 'transfer' | 'yearly': which of a donor's email settings
  // decides whether they get it
  kind: varchar("kind", { length: 24 }).notNull(),
  // What the team calls it; donors never see it.
  name: varchar("name", { length: 256 }).notNull().default(""),
  content: jsonb("content").$type<CampaignContent>().notNull(),
  audience: jsonb("audience").$type<AudienceFilters>().notNull(),
  // 'draft' | 'sending' | 'sent'. Only a draft can be changed.
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  createdBy: varchar("created_by", { length: 256 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  // Set while a backend process is sending the email, every few seconds. Any
  // process may be asked about it, so this, not memory, says whether sending
  // is going on, and which process may start it.
  heartbeatAt: timestamp("heartbeat_at"),
  // The process sending it: an id each one picks when it starts. One that
  // stalled for so long that another took over finds it changed, and stops
  // before it sends anything more.
  senderId: varchar("sender_id", { length: 36 }),
  // Why sending stopped to wait for the team, such as for address after
  // address refused: it goes on only from "Continue sending", not by itself.
  heldFor: text("held_for"),
  // The editor, one open tab, whose save was applied last, and that save's
  // number among its own. A save from the same editor that arrives after a
  // later one is left out: the one sent as the tab closes doesn't wait for
  // one still on its way. Another editor's save always counts.
  editorId: varchar("editor_id", { length: 36 }),
  editorSave: integer("editor_save"),
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;

// One donor's copy of an email from email_campaigns. A send claims the row
// before the email goes out, so that sending again, or after a crash, skips
// the donors who already got it.
export const emailSends = pgTable(
  "email_sends",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .references(() => emailCampaigns.id)
      .notNull(),
    donorId: integer("donor_id")
      .references(() => donors.id)
      .notNull(),
    // 'queued' | 'claimed' | 'sending' | 'sent' | 'failed' | 'skipped'. The
    // group is queued when the email is first sent, so sending again, or
    // after a crash, never reaches anyone else. A sender claims a copy, then
    // marks it 'sending' just before it goes out: a copy left 'claimed' is
    // queued again when sending goes on, but one left at 'sending' was cut
    // off mid-send and may or may not have gone out, so it isn't. 'failed'
    // never went out. 'skipped' is a donor who turned that kind of email off
    // after it was queued.
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    error: text("error"),
    // How many times it was put back in the queue without the mail server
    // taking it. It then waits behind the copies not tried yet, and fails
    // after a few times, so one copy can't hold up the rest.
    attempts: integer("attempts").notNull().default(0),
    // When one whose address the mail server refused for now, as greylisting
    // or a full mailbox does, may be tried again: not at the next go, a
    // minute later, which would use up its tries before either clears.
    retryAt: timestamp("retry_at"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("email_sends_campaign_donor_unique").on(t.campaignId, t.donorId),
  ],
);

export type EmailSend = typeof emailSends.$inferSelect;
export type NewEmailSend = typeof emailSends.$inferInsert;
