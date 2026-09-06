/**
 * Pure helpers for `backfill-transfer-links` — match an outgoing bank payment to
 * the transfer round it belongs to.
 *
 * Recipient payments route through a small stable set of counterparties (GWWC,
 * Effective Ventures / CEA, and the EA Eesti MTÜ for the inter-account moves)
 * and land a few weeks after the round's date. Everything else in the `outgoing`
 * bucket is operational spend and must not be linked.
 */

export const RECIPIENT_COUNTERPARTIES = [
  "giving what we can",
  "effective ventures",
  "centre for effective altruism",
  "efektiivne altruism eesti",
];

export function isRecipientCounterparty(
  name: string | null | undefined,
  allowlist: string[] = RECIPIENT_COUNTERPARTIES,
): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return allowlist.some((a) => n.includes(a));
}

export interface RoundRef {
  id: number;
  /** YYYY-MM-DD (or an ISO string — only the date part is used) */
  datetime: string;
}

const dayMs = 86_400_000;
const asDay = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/**
 * The most recent round on or before `rowDate`, but only if the payment is
 * within `lookbackDays` of it — a payment older than every round, or one that
 * trails its round by more than a quarter, is left for manual handling.
 */
export function assignToRound(
  rowDate: string,
  rounds: RoundRef[],
  lookbackDays = 120,
): number | null {
  const t = asDay(rowDate);
  if (Number.isNaN(t)) return null;

  let best: RoundRef | null = null;
  for (const r of rounds) {
    const rt = asDay(r.datetime);
    if (Number.isNaN(rt) || rt > t) continue;
    if (!best || rt > asDay(best.datetime)) best = r;
  }
  if (!best) return null;

  return (t - asDay(best.datetime)) / dayMs <= lookbackDays ? best.id : null;
}
