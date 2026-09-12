/**
 * A recurring donation (and, by extension, its donor) counts as currently
 * active when a finalized donation tied to it landed within this window.
 * The one payment-based definition shared by DashboardRepository's
 * getMonthlyRecurringDonations, DonorsRepository's recurringDonor /
 * recurringStatus filters, and RecurringDonationsRepository's status
 * column — not donors.recurringDonor or recurring_donations.active, both
 * deprecated, manually-set columns that drift from actual payment activity
 * (neither is ever updated after creation in current application code).
 */
export const RECURRING_ACTIVITY_WINDOW_DAYS = 60;
