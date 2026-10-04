/**
 * A recurring donation (and, by extension, its donor) counts as currently
 * active when a finalized donation tied to it landed within this window.
 * The one payment-based definition shared by DashboardRepository's
 * getMonthlyRecurringDonations, DonorsRepository's recurringDonor /
 * recurringStatus filters, and RecurringDonationsRepository's status
 * column. Nothing stores it: the manually-set flags that used to
 * (donors.recurring_donor, recurring_donations.active) were never updated
 * after creation, drifted from actual payments, and are gone from the schema.
 */
export const RECURRING_ACTIVITY_WINDOW_DAYS = 60;

/**
 * Never started: no finalized donation has ever been linked to this
 * recurring donation (the mandate exists, but the first payment never went
 * through). Stopped: had one at some point, but nothing within the current
 * window. Active: a finalized linked donation landed within the window.
 */
export type RecurringDonationStatus = "active" | "stopped" | "neverStarted";

/**
 * One recurring donation's status from its linked donations, for callers
 * that already hold them. RecurringDonationsRepository.findPaginated computes
 * the same thing in SQL, for a whole page at once.
 */
export function recurringDonationStatus(
  linkedDonations: { finalized: boolean; datetime: Date }[],
  now: Date = new Date(),
): RecurringDonationStatus {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RECURRING_ACTIVITY_WINDOW_DAYS);
  const finalized = linkedDonations.filter((d) => d.finalized);
  if (finalized.some((d) => new Date(d.datetime) >= cutoff)) return "active";
  return finalized.length > 0 ? "stopped" : "neverStarted";
}
