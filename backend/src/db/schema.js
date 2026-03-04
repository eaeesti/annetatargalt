"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationRecurringDonationsRelations = exports.organizationDonationsRelations = exports.donationTransfersRelations = exports.recurringDonationsRelations = exports.donationsRelations = exports.donorsRelations = exports.organizationRecurringDonations = exports.organizationDonations = exports.donations = exports.donationTransfers = exports.recurringDonations = exports.donors = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// Donors table
exports.donors = (0, pg_core_1.pgTable)("donors", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    idCode: (0, pg_core_1.varchar)("id_code", { length: 11 }),
    firstName: (0, pg_core_1.varchar)("first_name", { length: 128 }),
    lastName: (0, pg_core_1.varchar)("last_name", { length: 128 }),
    email: (0, pg_core_1.varchar)("email", { length: 256 }),
    recurringDonor: (0, pg_core_1.boolean)("recurring_donor").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Recurring donations table (subscription templates)
exports.recurringDonations = (0, pg_core_1.pgTable)("recurring_donations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    donorId: (0, pg_core_1.integer)("donor_id")
        .references(() => exports.donors.id)
        .notNull(),
    active: (0, pg_core_1.boolean)("active").default(false).notNull(),
    companyName: (0, pg_core_1.varchar)("company_name", { length: 128 }),
    companyCode: (0, pg_core_1.varchar)("company_code", { length: 128 }),
    comment: (0, pg_core_1.text)("comment"),
    bank: (0, pg_core_1.varchar)("bank", { length: 64 }),
    amount: (0, pg_core_1.integer)("amount").notNull(), // in cents
    datetime: (0, pg_core_1.timestamp)("datetime").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Donation transfers table (batch transfer tracking)
exports.donationTransfers = (0, pg_core_1.pgTable)("donation_transfers", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    datetime: (0, pg_core_1.date)("datetime").notNull(),
    recipient: (0, pg_core_1.varchar)("recipient", { length: 256 }),
    notes: (0, pg_core_1.text)("notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Donations table (one-time donations)
exports.donations = (0, pg_core_1.pgTable)("donations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    donorId: (0, pg_core_1.integer)("donor_id").references(() => exports.donors.id), // Can be null for old legacy donations
    recurringDonationId: (0, pg_core_1.integer)("recurring_donation_id").references(() => exports.recurringDonations.id),
    donationTransferId: (0, pg_core_1.integer)("donation_transfer_id").references(() => exports.donationTransfers.id),
    datetime: (0, pg_core_1.timestamp)("datetime").notNull(),
    amount: (0, pg_core_1.integer)("amount").notNull(), // in cents
    finalized: (0, pg_core_1.boolean)("finalized").default(false).notNull(),
    paymentMethod: (0, pg_core_1.varchar)("payment_method", { length: 64 }),
    iban: (0, pg_core_1.varchar)("iban", { length: 34 }),
    comment: (0, pg_core_1.text)("comment"),
    companyName: (0, pg_core_1.varchar)("company_name", { length: 128 }),
    companyCode: (0, pg_core_1.varchar)("company_code", { length: 128 }),
    sentToOrganization: (0, pg_core_1.boolean)("sent_to_organization").default(false).notNull(),
    dedicationName: (0, pg_core_1.varchar)("dedication_name", { length: 128 }),
    dedicationEmail: (0, pg_core_1.varchar)("dedication_email", { length: 256 }),
    dedicationMessage: (0, pg_core_1.text)("dedication_message"),
    externalDonation: (0, pg_core_1.boolean)("external_donation").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Organization donations junction table (splits donations across organizations)
exports.organizationDonations = (0, pg_core_1.pgTable)("organization_donations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    donationId: (0, pg_core_1.integer)("donation_id")
        .references(() => exports.donations.id)
        .notNull(),
    organizationInternalId: (0, pg_core_1.varchar)("organization_internal_id", {
        length: 64,
    }).notNull(), // Links to Strapi organization.internalId
    amount: (0, pg_core_1.integer)("amount").notNull(), // in cents
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Organization recurring donations junction table
exports.organizationRecurringDonations = (0, pg_core_1.pgTable)("organization_recurring_donations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    recurringDonationId: (0, pg_core_1.integer)("recurring_donation_id")
        .references(() => exports.recurringDonations.id)
        .notNull(),
    organizationInternalId: (0, pg_core_1.varchar)("organization_internal_id", {
        length: 64,
    }).notNull(), // Links to Strapi organization.internalId
    amount: (0, pg_core_1.integer)("amount").notNull(), // in cents
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Relations for better query experience
exports.donorsRelations = (0, drizzle_orm_1.relations)(exports.donors, ({ many }) => ({
    donations: many(exports.donations),
    recurringDonations: many(exports.recurringDonations),
}));
exports.donationsRelations = (0, drizzle_orm_1.relations)(exports.donations, ({ one, many }) => ({
    donor: one(exports.donors, {
        fields: [exports.donations.donorId],
        references: [exports.donors.id],
    }),
    recurringDonation: one(exports.recurringDonations, {
        fields: [exports.donations.recurringDonationId],
        references: [exports.recurringDonations.id],
    }),
    donationTransfer: one(exports.donationTransfers, {
        fields: [exports.donations.donationTransferId],
        references: [exports.donationTransfers.id],
    }),
    organizationDonations: many(exports.organizationDonations),
}));
exports.recurringDonationsRelations = (0, drizzle_orm_1.relations)(exports.recurringDonations, ({ one, many }) => ({
    donor: one(exports.donors, {
        fields: [exports.recurringDonations.donorId],
        references: [exports.donors.id],
    }),
    donations: many(exports.donations),
    organizationRecurringDonations: many(exports.organizationRecurringDonations),
}));
exports.donationTransfersRelations = (0, drizzle_orm_1.relations)(exports.donationTransfers, ({ many }) => ({
    donations: many(exports.donations),
}));
exports.organizationDonationsRelations = (0, drizzle_orm_1.relations)(exports.organizationDonations, ({ one }) => ({
    donation: one(exports.donations, {
        fields: [exports.organizationDonations.donationId],
        references: [exports.donations.id],
    }),
}));
exports.organizationRecurringDonationsRelations = (0, drizzle_orm_1.relations)(exports.organizationRecurringDonations, ({ one }) => ({
    recurringDonation: one(exports.recurringDonations, {
        fields: [exports.organizationRecurringDonations.recurringDonationId],
        references: [exports.recurringDonations.id],
    }),
}));
