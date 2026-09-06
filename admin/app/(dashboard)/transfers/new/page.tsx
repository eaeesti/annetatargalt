import Link from "next/link";
import { strapiAdmin } from "../../../../lib/api";
import { fetchOrgs } from "../../../../lib/orgs";
import { TransferBuilder } from "../_components/transfer-builder";

/** Day after the given YYYY-MM-DD, as YYYY-MM-DD. */
function dayAfter(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function NewTransferPage() {
  // Default the "from" date to the day after the most recent transfer round,
  // so consecutive rounds tile the timeline with no gap or overlap.
  let defaultFrom: string | undefined;
  const [res, orgs] = await Promise.all([
    strapiAdmin(
      "/api/admin-panel/transfers/list?pageSize=25&sortBy=datetime&sortDir=desc",
      { cache: "no-store" },
    ),
    fetchOrgs(),
  ]);
  if (res.ok) {
    const { data } = (await res.json()) as { data: { datetime: string }[] };
    if (data[0]?.datetime) defaultFrom = dayAfter(data[0].datetime);
  }
  const orgNames: Record<string, string> = Object.fromEntries(
    orgs.map((o) => [o.internalId, o.title ?? o.internalId]),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/transfers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Transfers
        </Link>
        <h1 className="text-2xl font-bold">New transfer round</h1>
        <p className="text-sm text-muted-foreground">
          Pick a date range to seed the list of finalized, not-yet-transferred
          donations, adjust it, then create the round.
        </p>
      </div>
      <TransferBuilder defaultFrom={defaultFrom} orgNames={orgNames} />
    </div>
  );
}
