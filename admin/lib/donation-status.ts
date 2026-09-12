const STALE_PENDING_HOURS = 24;

export type DonationStatus = "finalized" | "pending" | "cancelled";

/**
 * Admin-panel-only display status — never touches `finalized` in the
 * database. A donation still pending 24+ hours after it started is shown as
 * "Cancelled": real payment methods finalize within minutes, so anything
 * still open a day later is almost certainly an abandoned attempt (closed
 * tab mid-redirect, a silently failed bank/card flow, etc), not one still
 * genuinely in progress.
 */
export function donationStatus(
  finalized: boolean,
  datetime: string | Date,
): DonationStatus {
  if (finalized) return "finalized";
  const ageMs = Date.now() - new Date(datetime).getTime();
  return ageMs > STALE_PENDING_HOURS * 60 * 60 * 1000 ? "cancelled" : "pending";
}
