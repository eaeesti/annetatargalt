import { Badge } from "./ui/badge";

/**
 * A recurring donation's status as the backend computes it from payments: a
 * finalized linked donation within the last 60 days makes it active.
 */
export type RecurringDonationStatus = "active" | "stopped" | "neverStarted";

export function RecurringStatusBadge({
  status,
}: {
  status: RecurringDonationStatus;
}) {
  if (status === "active") return <Badge variant="default">Active</Badge>;
  if (status === "stopped") return <Badge variant="destructive">Stopped</Badge>;
  return <Badge variant="secondary">Never started</Badge>;
}
