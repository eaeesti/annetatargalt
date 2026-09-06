/**
 * Link historical `outgoing` bank transactions to the transfer round they paid
 * out — a one-time backfill (rounds 1–N predate the `/transfers` link UI).
 *
 *   yarn backfill-transfer-links [--apply]
 *
 * Dry run by default: prints the proposed grouping and changes nothing.
 * `--apply` commits, in one transaction. Idempotent (linked rows drop out).
 *
 * A candidate is an `outgoing` row with no `donation_transfer_id` whose
 * counterparty is on the recipient allowlist (`utils/transfer-links.ts`). It is
 * assigned to the most recent round on/before its date, within a 120-day
 * lookback. Operational spend (tax, reimbursements, vendors) never matches the
 * allowlist and is left alone; a few small direct payments (WAI, GiveDirectly…)
 * that don't route through an allowlisted counterparty show up as a residual
 * `delta` and are handled in the /transfers UI.
 *
 * Run with the production environment loaded.
 */
import { closeDatabase, db } from "../db/client";
import {
  bankTransactionsRepository,
  BankTransactionsRepository,
  donationTransfersRepository,
} from "../db/repositories";
import {
  assignToRound,
  isRecipientCounterparty,
  type RoundRef,
} from "../utils/transfer-links";

const APPLY = process.argv.includes("--apply");
const LOOKBACK_DAYS = 120;
/** Rounds whose proposed payments miss `owed` by more than this are left for
 *  manual review (the heuristic likely mis-grouped an irregular round). */
const MAX_DELTA_CENTS = 500;
const MAX_DELTA_FRACTION = 0.25;

const eur = (c: number | null | undefined) =>
  c == null ? "—" : `€${(c / 100).toFixed(2)}`;

async function main() {
  const rounds = await donationTransfersRepository.listWithOwed();
  const roundRefs: RoundRef[] = rounds.map((r) => ({
    id: r.id,
    datetime: r.datetime,
  }));
  const owedById = new Map(rounds.map((r) => [r.id, r.owedCents]));

  const outgoing = await bankTransactionsRepository.findUnlinkedOutgoing({});
  const candidates = outgoing.filter((r) =>
    isRecipientCounterparty(r.counterpartyName),
  );

  console.log(
    `${outgoing.length} unlinked outgoing row(s), ${candidates.length} match a recipient counterparty` +
      (APPLY ? "" : "  (dry run — pass --apply to write)") +
      "\n",
  );

  const byRound = new Map<number, typeof candidates>();
  const unassigned: typeof candidates = [];
  for (const row of candidates) {
    const roundId = row.date
      ? assignToRound(row.date, roundRefs, LOOKBACK_DAYS)
      : null;
    if (roundId == null) {
      unassigned.push(row);
      continue;
    }
    const arr = byRound.get(roundId) ?? [];
    arr.push(row);
    byRound.set(roundId, arr);
  }

  const toLink = new Map<number, typeof candidates>();

  for (const round of rounds) {
    const rows = byRound.get(round.id);
    if (!rows || rows.length === 0) continue;
    const matched = rows.reduce((s, r) => s + Math.abs(r.amountCents ?? 0), 0);
    const owed = owedById.get(round.id) ?? 0;
    const delta = owed - matched;
    const withinTolerance =
      Math.abs(delta) <= MAX_DELTA_CENTS ||
      (owed > 0 && Math.abs(delta) <= owed * MAX_DELTA_FRACTION);

    console.log(
      `Transfer #${round.id}  ${round.datetime}   owed ${eur(owed)}  ·  matched ${eur(
        matched,
      )}  ·  delta ${eur(delta)}  (${rows.length} payment${rows.length === 1 ? "" : "s"})` +
        (withinTolerance
          ? ""
          : "   ⚠ NEEDS REVIEW — not linked, fix in the UI"),
    );
    for (const r of rows) {
      console.log(
        `    ${r.date ?? "??????????"}  ${eur(Math.abs(r.amountCents ?? 0)).padStart(11)}  ${r.counterpartyName ?? "—"}  ${r.archivingCode}`,
      );
    }

    if (withinTolerance) toLink.set(round.id, rows);
  }

  if (unassigned.length > 0) {
    console.log(
      `\n${unassigned.length} recipient payment(s) with no round within ${LOOKBACK_DAYS} days — handle manually:`,
    );
    for (const r of unassigned) {
      console.log(
        `    ${r.date ?? "??????????"}  ${eur(Math.abs(r.amountCents ?? 0))}  ${r.counterpartyName ?? "—"}  ${r.archivingCode}`,
      );
    }
  }

  const totalToLink = [...toLink.values()].reduce((s, a) => s + a.length, 0);
  const skipped = byRound.size - toLink.size;
  if (!APPLY) {
    console.log(
      `\n${totalToLink} payment(s) would be linked across ${toLink.size} round(s)` +
        (skipped > 0 ? `, ${skipped} round(s) need review` : "") +
        `. Re-run with --apply.`,
    );
    return;
  }

  await db.transaction(async (tx) => {
    const bankRepo = new BankTransactionsRepository(tx);
    for (const [roundId, rows] of toLink) {
      const r = await bankRepo.setDonationTransfer(
        rows.map((x) => x.archivingCode),
        roundId,
      );
      if (!r.ok)
        throw new Error(`link failed for round ${roundId}: ${r.reason}`);
    }
  });

  console.log(
    `\nDone — ${totalToLink} payment(s) linked across ${toLink.size} round(s)` +
      (skipped > 0 ? `, ${skipped} round(s) left for manual review` : "") +
      `.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
