import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Database } from "../client";
import { bankTransactions, type BankTransaction } from "../schema";

export type BankTransactionCategory =
  | "donation"
  | "card-payout"
  | "outgoing" // debit — money leaving the account (org transfer, fee, refund, tax)
  | "ignored"
  | "undecided"
  | "unimported"; // migration stub — a donation points here, bank line not yet imported

/**
 * When a re-upload's heuristic category meets an existing row, higher wins.
 * `ignored` is stickiest — a "not a donation" decision must not be reverted by
 * a later import's `looksLikeCardPayout` heuristic. An explicit operator action
 * (reconcile / ignore / recurring-import) sets `reclassify` and bypasses this.
 */
const CATEGORY_PRECEDENCE: Record<string, number> = {
  ignored: 4,
  donation: 3,
  "card-payout": 3, // peer of donation — allow the donation↔card-payout upgrade
  outgoing: 3, // debits never collide with credit codes; keep them pinned
  undecided: 1,
  unimported: 0, // any real import wins over a migration stub
};
const prec = (c: string) => CATEGORY_PRECEDENCE[c] ?? 0;

const trunc = (v: string | null | undefined, n: number) =>
  v == null ? null : v.slice(0, n);

/** ~12 bind params per inserted row; 1 per code in a SELECT ... IN (...). */
const INSERT_CHUNK = 1000;
const SELECT_CHUNK = 10000;

export interface BankTransactionUpsert {
  archivingCode: string;
  date?: string | null; // YYYY-MM-DD
  amountCents?: number | null;
  description?: string | null;
  counterpartyName?: string | null;
  counterpartyAccount?: string | null;
  senderCode?: string | null;
  category: BankTransactionCategory;
  /** explicit operator decision — set category verbatim, bypass precedence */
  reclassify?: boolean;
  note?: string | null;
  importedBy?: string | null;
  grossAmountCents?: number | null; // card payouts only
  feeAmountCents?: number | null; // card payouts only
}

export interface BankTransactionRow extends BankTransaction {
  /** donations carrying this archiving code (finalized + pending) */
  linkedDonationCount: number;
  /** Σ organization_donations.amount for the finalized ones */
  allocatedCents: number;
  /** Σ donation.amount (gross) across all linked donations */
  linkedGrossCents: number;
  /** bank `amount` ≈ linked gross − fee, within rounding; null when not assessable */
  balanced: boolean | null;
}

export interface OutgoingRow {
  archivingCode: string;
  date: string | null;
  amountCents: number | null;
  counterpartyName: string | null;
  description: string | null;
  donationTransferId: number | null;
}

export interface MoneyFlow {
  dateFrom: string | null;
  dateTo: string | null;
  /** Σ amount, category = 'donation' */
  received: number;
  /** Σ amount, category = 'card-payout' (net, after processor fee) */
  cardPayoutNet: number;
  /** Σ gross_amount (→ amount where null), category = 'card-payout' */
  cardPayoutGross: number;
  /** Σ fee_amount, category = 'card-payout' (stored, from Montonio) */
  cardFees: number;
  /** Σ donations.processor_fee_cents for card-payout-linked donations — should match cardFees */
  cardFeesFromDonations: number;
  /** Σ organization_donations.amount for donations linked to in-range bank rows */
  allocated: number;
  /** …of which the donation is already in a donation_transfer (assigned to a round) */
  transferred: number;
  /** Σ amount of `outgoing` rows linked to a transfer round (money actually paid out) — date-scoped */
  transferPaidOut: number;
  /** Σ |owed − paidOut| over rounds that have started paying out but sit outside tolerance — all-time */
  transferGap: number;
  /** Σ organization_donations.amount for finalized, reconciled donations not yet in a round — all-time */
  notYetTransferred: number;
  /** Σ amount, category = 'undecided' */
  undecidedInflow: number;
  /** Σ amount, category = 'outgoing' (debits — money that left the account) */
  outgoingTotal: number;
  /** codes still 'unimported' (migration stubs whose bank line hasn't been imported) — not date-filtered */
  unimportedRows: number;
  /** Σ amount of donation/card-payout bank rows linked to a still-pending donation — excluded from received/cardPayoutNet until it finalizes */
  pendingLinkedCents: number;
  /** finalized donations with no transaction_id at all (standing backlog, not date-filtered) */
  unlinkedDonationCount: number;
  unlinkedDonationCents: number;
  /** allocated − (received + cardPayoutNet + cardFees) — should be ~0 */
  discrepancy: number;
}

/** The "OK" column state — see `mapRow` for how `balanced` is derived. */
export type BalancedFilter = "ok" | "not-ok" | "unknown";

interface FindPaginatedOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  /** filter on the computed "OK" state */
  balanced?: BalancedFilter;
}

const num = (v: unknown) => Number(v ?? 0);

function mapRow(r: Record<string, unknown>): BankTransactionRow {
  const amount = r.amount == null ? null : num(r.amount);
  const feeAmount = r.fee_amount == null ? null : num(r.fee_amount);
  const linkedDonationCount = num(r.linked_donation_count);
  const pendingDonationCount = num(r.pending_donation_count);
  const linkedGrossCents = num(r.linked_gross_cents);
  const expectedNet = linkedGrossCents - (feeAmount ?? 0);
  // null = not assessable yet: no linked donations, bank line not imported, or a
  // linked donation isn't finalized (its amount can still change)
  const balanced =
    linkedDonationCount === 0 || amount == null || pendingDonationCount > 0
      ? null
      : Math.abs(amount - expectedNet) <= Math.max(1, linkedDonationCount);

  return {
    archivingCode: r.archiving_code as string,
    date: r.date as string | null,
    amount,
    description: (r.description as string | null) ?? null,
    counterpartyName: (r.counterparty_name as string | null) ?? null,
    counterpartyAccount: (r.counterparty_account as string | null) ?? null,
    senderCode: (r.sender_code as string | null) ?? null,
    category: r.category as string,
    grossAmount: r.gross_amount == null ? null : num(r.gross_amount),
    feeAmount,
    note: (r.note as string | null) ?? null,
    donationTransferId:
      r.donation_transfer_id == null ? null : num(r.donation_transfer_id),
    importedAt: r.imported_at as Date,
    importedBy: (r.imported_by as string | null) ?? null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
    linkedDonationCount,
    allocatedCents: num(r.allocated_cents),
    linkedGrossCents,
    balanced,
  };
}

export class BankTransactionsRepository {
  constructor(private database: Database = db) {}

  /** Codes currently marked "not a donation" — the old ignore list. */
  async ignoredCodes(): Promise<Set<string>> {
    const rows = await this.database
      .select({ code: bankTransactions.archivingCode })
      .from(bankTransactions)
      .where(eq(bankTransactions.category, "ignored"));
    return new Set(rows.map((r) => r.code));
  }

  /** Every archiving code already in the table (any category). */
  async recordedCodes(): Promise<Set<string>> {
    const rows = await this.database
      .select({ code: bankTransactions.archivingCode })
      .from(bankTransactions);
    return new Set(rows.map((r) => r.code));
  }

  /** Codes still `category = 'unimported'` (migration stubs). */
  async unimportedCodes(): Promise<Set<string>> {
    const rows = await this.database
      .select({ code: bankTransactions.archivingCode })
      .from(bankTransactions)
      .where(eq(bankTransactions.category, "unimported"));
    return new Set(rows.map((r) => r.code));
  }

  /**
   * code → current category, for the codes given. Chunked so a full-history
   * lookup doesn't exceed Postgres' bind-parameter limit.
   */
  async categoriesFor(codes: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (let i = 0; i < codes.length; i += SELECT_CHUNK) {
      const rows = await this.database
        .select({
          code: bankTransactions.archivingCode,
          category: bankTransactions.category,
        })
        .from(bankTransactions)
        .where(
          inArray(
            bankTransactions.archivingCode,
            codes.slice(i, i + SELECT_CHUNK),
          ),
        );
      for (const r of rows) out.set(r.code, r.category);
    }
    return out;
  }

  async findAll(): Promise<BankTransaction[]> {
    return this.database.query.bankTransactions.findMany({
      orderBy: (t, { desc }) => [desc(t.date)],
    });
  }

  /**
   * Idempotent upsert of statement lines. Bank fields are refreshed (coalesced —
   * a real line fills in a blind ignore). `category` follows precedence
   * (ignored is stickiest) UNLESS the row is `reclassify` (an explicit operator
   * decision), so a re-upload can't silently un-ignore a code but an operator
   * still can. Returns how many codes were newly written — inserted, or a
   * migration stub ('unimported') given a real category (0 on a no-op re-run).
   */
  async upsertMany(rows: BankTransactionUpsert[]): Promise<number> {
    if (rows.length === 0) return 0;

    // dedupe input by code — a reclassify row, else the higher-precedence one
    const byCode = new Map<string, BankTransactionUpsert>();
    for (const r of rows) {
      const archivingCode = r.archivingCode.slice(0, 20);
      const prev = byCode.get(archivingCode);
      const better =
        !prev ||
        (r.reclassify && !prev.reclassify) ||
        (Boolean(r.reclassify) === Boolean(prev.reclassify) &&
          prec(r.category) >= prec(prev.category));
      if (better) byCode.set(archivingCode, { ...r, archivingCode });
    }
    const deduped = [...byCode.values()];

    const existingCat = await this.categoriesFor(
      deduped.map((r) => r.archivingCode),
    );

    // group by the resolved final category — one upsert statement per group
    const groups = new Map<string, BankTransactionUpsert[]>();
    const finalCatByCode = new Map<string, string>();
    for (const r of deduped) {
      const cur = existingCat.get(r.archivingCode);
      const finalCat =
        !r.reclassify && cur && prec(cur) > prec(r.category) ? cur : r.category;
      finalCatByCode.set(r.archivingCode, finalCat);
      const arr = groups.get(finalCat) ?? [];
      arr.push(r);
      groups.set(finalCat, arr);
    }

    for (const [finalCat, groupRows] of groups) {
      for (let i = 0; i < groupRows.length; i += INSERT_CHUNK) {
        await this.database
          .insert(bankTransactions)
          .values(
            groupRows.slice(i, i + INSERT_CHUNK).map((r) => ({
              archivingCode: r.archivingCode,
              date: r.date ?? null,
              amount: r.amountCents ?? null,
              description: r.description ?? null,
              counterpartyName: trunc(r.counterpartyName, 256),
              counterpartyAccount: trunc(r.counterpartyAccount, 64),
              senderCode: trunc(r.senderCode, 64),
              category: finalCat,
              grossAmount: r.grossAmountCents ?? null,
              feeAmount: r.feeAmountCents ?? null,
              note: trunc(r.note, 512),
              importedBy: trunc(r.importedBy, 256),
            })),
          )
          .onConflictDoUpdate({
            target: bankTransactions.archivingCode,
            set: {
              // A bank line never changes once seen. On a re-import we only
              // FILL IN fields that are still null (a migration stub or a
              // blind ignore getting its first real data) — an existing value
              // is frozen, so re-uploading a statement can't clobber a manual
              // correction (e.g. a foreign-currency amount).
              date: sql`coalesce(${bankTransactions.date}, excluded."date")`,
              amount: sql`coalesce(${bankTransactions.amount}, excluded."amount")`,
              description: sql`coalesce(${bankTransactions.description}, excluded."description")`,
              counterpartyName: sql`coalesce(${bankTransactions.counterpartyName}, excluded."counterparty_name")`,
              counterpartyAccount: sql`coalesce(${bankTransactions.counterpartyAccount}, excluded."counterparty_account")`,
              senderCode: sql`coalesce(${bankTransactions.senderCode}, excluded."sender_code")`,
              category: finalCat,
              grossAmount: sql`coalesce(${bankTransactions.grossAmount}, excluded."gross_amount")`,
              feeAmount: sql`coalesce(${bankTransactions.feeAmount}, excluded."fee_amount")`,
              note: sql`coalesce(${bankTransactions.note}, excluded."note")`,
              importedBy: sql`coalesce(${bankTransactions.importedBy}, excluded."imported_by")`,
              updatedAt: sql`now()`,
            },
          });
      }
    }

    // rows that went from nothing (or a migration stub) to a real category
    return deduped.filter((r) => {
      const cur = existingCat.get(r.archivingCode);
      const final = finalCatByCode.get(r.archivingCode);
      return (
        (cur === undefined || cur === "unimported") && final !== "unimported"
      );
    }).length;
  }

  /**
   * Reclassify one code from the /transactions UI. Refuses to move a code away
   * from a donation-bearing category while ANY donation (finalized or not) still
   * references it — a pending donation could be finalized later.
   */
  async setCategory(
    code: string,
    category: BankTransactionCategory,
    note: string | null,
    by: string | null,
  ): Promise<{ ok: boolean; reason?: "not-found" | "has-donations" }> {
    if (category !== "donation" && category !== "card-payout") {
      const [linked] = await this.database
        .execute(
          sql`SELECT cast(count(*) as int) as n FROM donations WHERE transaction_id = ${code}`,
        )
        .then((r) => r.rows as { n: number }[]);
      if (num(linked?.n) > 0) return { ok: false, reason: "has-donations" };
    }
    const updated = await this.database
      .update(bankTransactions)
      .set({
        category,
        note: trunc(note, 512),
        importedBy: trunc(by, 256),
        updatedAt: new Date(),
      })
      .where(eq(bankTransactions.archivingCode, code))
      .returning({ code: bankTransactions.archivingCode });
    return updated.length > 0
      ? { ok: true }
      : { ok: false, reason: "not-found" };
  }

  /**
   * Update only the free-text note on a row, leaving its category untouched.
   * Used to document a linked payout ("sent to <org>") from the transfer view.
   */
  async updateNote(code: string, note: string | null): Promise<boolean> {
    const updated = await this.database
      .update(bankTransactions)
      .set({ note: trunc(note, 512), updatedAt: new Date() })
      .where(eq(bankTransactions.archivingCode, code))
      .returning({ code: bankTransactions.archivingCode });
    return updated.length > 0;
  }

  /** `card-payout` rows with no stored processor fee yet (backfill candidates). */
  async cardPayoutsMissingFee(): Promise<BankTransaction[]> {
    return this.database
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.category, "card-payout"),
          isNull(bankTransactions.feeAmount),
        ),
      )
      .orderBy(bankTransactions.date);
  }

  /** Set the gross/fee on a card-payout row (used by the fee backfill script). */
  async recordPayoutTotals(
    code: string,
    grossCents: number,
    feeCents: number,
  ): Promise<boolean> {
    const updated = await this.database
      .update(bankTransactions)
      .set({
        grossAmount: grossCents,
        feeAmount: feeCents,
        updatedAt: new Date(),
      })
      .where(eq(bankTransactions.archivingCode, code))
      .returning({ code: bankTransactions.archivingCode });
    return updated.length > 0;
  }

  /**
   * Link (or unlink, with `transferId = null`) `outgoing` bank rows to a
   * transfer round. Refuses any code that isn't currently `category = 'outgoing'`
   * — only real debits get attributed to a payout round.
   */
  async setDonationTransfer(
    codes: string[],
    transferId: number | null,
  ): Promise<{
    ok: boolean;
    reason?: "not-outgoing" | "not-found" | "already-linked";
  }> {
    if (codes.length === 0) return { ok: true };
    const rows = await this.database
      .select({
        code: bankTransactions.archivingCode,
        category: bankTransactions.category,
        donationTransferId: bankTransactions.donationTransferId,
      })
      .from(bankTransactions)
      .where(inArray(bankTransactions.archivingCode, codes));

    if (rows.length !== codes.length) return { ok: false, reason: "not-found" };
    if (rows.some((r) => r.category !== "outgoing"))
      return { ok: false, reason: "not-outgoing" };
    // linking (not unlinking): don't silently steal a payment from another round
    if (
      transferId != null &&
      rows.some(
        (r) =>
          r.donationTransferId != null && r.donationTransferId !== transferId,
      )
    ) {
      return { ok: false, reason: "already-linked" };
    }

    await this.database
      .update(bankTransactions)
      .set({ donationTransferId: transferId, updatedAt: new Date() })
      .where(inArray(bankTransactions.archivingCode, codes));
    return { ok: true };
  }

  /** `outgoing` rows not yet attributed to a transfer round — the "link a payment" picker. */
  async findUnlinkedOutgoing(opts: {
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<OutgoingRow[]> {
    const conds = [
      sql`category = 'outgoing'`,
      sql`donation_transfer_id IS NULL`,
    ];
    if (opts.dateFrom) conds.push(sql`date >= ${opts.dateFrom}`);
    if (opts.dateTo) conds.push(sql`date <= ${opts.dateTo}`);
    if (opts.search) {
      const like = `%${opts.search}%`;
      conds.push(
        sql`(counterparty_name ilike ${like} or description ilike ${like} or archiving_code ilike ${like})`,
      );
    }
    const res = await this.database.execute(sql`
      SELECT archiving_code, date, amount, counterparty_name, description, donation_transfer_id
      FROM bank_transactions
      WHERE ${sql.join(conds, sql` and `)}
      ORDER BY date asc, archiving_code asc
    `);
    return (res.rows as Record<string, unknown>[]).map((r) => ({
      archivingCode: r.archiving_code as string,
      date: r.date as string | null,
      amountCents: r.amount == null ? null : num(r.amount),
      counterpartyName: (r.counterparty_name as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      donationTransferId:
        r.donation_transfer_id == null ? null : num(r.donation_transfer_id),
    }));
  }

  async findPaginated(
    opts: FindPaginatedOptions,
  ): Promise<{ data: BankTransactionRow[]; total: number }> {
    const { page, pageSize, sortBy = "date", sortDir = "desc" } = opts;

    const conds = [sql`1 = 1`];
    if (opts.category) conds.push(sql`bt.category = ${opts.category}`);
    if (opts.dateFrom) conds.push(sql`bt.date >= ${opts.dateFrom}`);
    if (opts.dateTo) conds.push(sql`bt.date <= ${opts.dateTo}`);
    if (opts.search) {
      const like = `%${opts.search}%`;
      conds.push(
        sql`(bt.archiving_code ilike ${like} or bt.counterparty_name ilike ${like} or bt.description ilike ${like} or bt.sender_code ilike ${like})`,
      );
    }
    const where = sql.join(conds, sql` and `);

    const sortCols: Record<string, ReturnType<typeof sql>> = {
      date: sql`q.date`,
      amount: sql`q.amount`,
      category: sql`q.category`,
      counterpartyName: sql`q.counterparty_name`,
      importedAt: sql`q.imported_at`,
    };
    const sortCol = sortCols[sortBy] ?? sql`q.date`;
    const dir = sortDir === "asc" ? sql`asc` : sql`desc`;
    // pageSize <= 0 means "all rows" (the /transactions "View all" option)
    const limitClause =
      pageSize > 0
        ? sql`LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
        : sql``;

    // Same "OK" test as `mapRow` — kept here only so the list can be filtered on
    // it. A null feeAmount counts as a zero fee (matches `mapRow`).
    const balancedState = sql`CASE
      WHEN q.linked_donation_count = 0 OR q.amount IS NULL OR q.pending_donation_count > 0 THEN NULL
      WHEN abs(q.amount - (q.linked_gross_cents - coalesce(q.fee_amount, 0))) <= greatest(1, q.linked_donation_count) THEN true
      ELSE false
    END`;
    const balancedWhere =
      opts.balanced === "ok"
        ? sql`AND (${balancedState}) = true`
        : opts.balanced === "not-ok"
          ? sql`AND (${balancedState}) = false`
          : opts.balanced === "unknown"
            ? sql`AND (${balancedState}) IS NULL`
            : sql``;

    // inner query carries the computed columns the balanced test reads
    const scored = sql`
      SELECT bt.*,
        (SELECT cast(count(*) as int) FROM donations d
           WHERE d.transaction_id = bt.archiving_code) as linked_donation_count,
        (SELECT cast(count(*) as int) FROM donations d
           WHERE d.transaction_id = bt.archiving_code AND d.finalized = false) as pending_donation_count,
        (SELECT cast(coalesce(sum(od.amount), 0) as int)
           FROM organization_donations od
           JOIN donations d ON d.id = od.donation_id
           WHERE d.transaction_id = bt.archiving_code AND d.finalized = true) as allocated_cents,
        (SELECT cast(coalesce(sum(d.amount), 0) as int) FROM donations d
           WHERE d.transaction_id = bt.archiving_code) as linked_gross_cents
      FROM bank_transactions bt
      WHERE ${where}`;

    const rowsRes = await this.database.execute(sql`
      SELECT q.* FROM (${scored}) q
      WHERE 1 = 1 ${balancedWhere}
      ORDER BY ${sortCol} ${dir} NULLS LAST, q.archiving_code ${dir}
      ${limitClause}
    `);
    const countRes = await this.database.execute(sql`
      SELECT cast(count(*) as int) as total FROM (${scored}) q
      WHERE 1 = 1 ${balancedWhere}
    `);

    return {
      data: (rowsRes.rows as Record<string, unknown>[]).map(mapRow),
      total: num((countRes.rows[0] as { total?: number })?.total),
    };
  }

  async findByCodeWithDonations(code: string) {
    return this.database.query.bankTransactions.findFirst({
      where: eq(bankTransactions.archivingCode, code),
      with: {
        donations: {
          with: { donor: true, organizationDonations: true },
        },
      },
    });
  }

  async moneyFlow(opts: {
    dateFrom?: string | null;
    dateTo?: string | null;
  }): Promise<MoneyFlow> {
    const dateFrom = opts.dateFrom ?? null;
    const dateTo = opts.dateTo ?? null;

    const btDate = [];
    if (dateFrom) btDate.push(sql`bt.date >= ${dateFrom}`);
    if (dateTo) btDate.push(sql`bt.date <= ${dateTo}`);
    const btDateClause =
      btDate.length > 0 ? sql`AND ${sql.join(btDate, sql` AND `)}` : sql``;

    // A bank row with a still-pending linked donation can't be counted in
    // `received`/card figures yet — its `allocated` counterpart excludes
    // pending donations (org splits aren't final), so counting the bank side
    // now would show a spurious discrepancy until the donation finalizes.
    const [bank] = (
      await this.database.execute(sql`
      WITH bt_scope AS (
        SELECT bt.*, EXISTS (
          SELECT 1 FROM donations d
          WHERE d.transaction_id = bt.archiving_code AND d.finalized = false
        ) AS has_pending
        FROM bank_transactions bt
        WHERE bt.amount IS NOT NULL ${btDateClause}
      )
      SELECT
        cast(coalesce(sum(amount) filter (where category = 'donation' and not has_pending), 0) as int) as received,
        cast(coalesce(sum(amount) filter (where category = 'card-payout' and not has_pending), 0) as int) as card_payout_net,
        cast(coalesce(sum(coalesce(gross_amount, amount)) filter (where category = 'card-payout' and not has_pending), 0) as int) as card_payout_gross,
        cast(coalesce(sum(fee_amount) filter (where category = 'card-payout' and not has_pending), 0) as int) as card_fees,
        cast(coalesce(sum(amount) filter (where category = 'undecided'), 0) as int) as undecided_inflow,
        cast(coalesce(sum(abs(amount)) filter (where category = 'outgoing'), 0) as int) as outgoing_total,
        cast(coalesce(sum(abs(amount)) filter (where category = 'outgoing' and donation_transfer_id is not null), 0) as int) as transfer_paid_out,
        cast(coalesce(sum(amount) filter (where has_pending and category in ('donation', 'card-payout')), 0) as int) as pending_linked_total
      FROM bt_scope
    `)
    ).rows as Record<string, unknown>[];

    const [alloc] = (
      await this.database.execute(sql`
      SELECT
        cast(coalesce(sum(od.amount), 0) as int) as allocated,
        cast(coalesce(sum(od.amount) filter (where d.donation_transfer_id is not null), 0) as int) as transferred
      FROM organization_donations od
      JOIN donations d ON d.id = od.donation_id AND d.finalized = true
      JOIN bank_transactions bt ON bt.archiving_code = d.transaction_id
      WHERE bt.category IN ('donation', 'card-payout')
        AND bt.amount IS NOT NULL ${btDateClause}
    `)
    ).rows as Record<string, unknown>[];

    const [feeAgg] = (
      await this.database.execute(sql`
      SELECT cast(coalesce(sum(d.processor_fee_cents), 0) as int) as fee
      FROM donations d
      JOIN bank_transactions bt ON bt.archiving_code = d.transaction_id
      WHERE bt.category = 'card-payout' AND d.finalized = true ${btDateClause}
    `)
    ).rows as Record<string, unknown>[];

    const [unlinked] = (
      await this.database.execute(sql`
      SELECT cast(count(*) as int) as cnt, cast(coalesce(sum(amount), 0) as int) as total
      FROM donations
      WHERE finalized = true AND transaction_id IS NULL
    `)
    ).rows as Record<string, unknown>[];

    const [stubs] = (
      await this.database.execute(sql`
      SELECT cast(count(*) as int) as cnt
      FROM bank_transactions WHERE category = 'unimported'
    `)
    ).rows as Record<string, unknown>[];

    // Standing "money in flight" figures — not date-filtered.
    const [notYet] = (
      await this.database.execute(sql`
      SELECT cast(coalesce(sum(od.amount), 0) as int) as total
      FROM organization_donations od
      JOIN donations d ON d.id = od.donation_id AND d.finalized = true
      WHERE d.donation_transfer_id IS NULL AND d.transaction_id IS NOT NULL
    `)
    ).rows as Record<string, unknown>[];

    // Σ of the ABSOLUTE owed↔paidOut gap over rounds that have started paying
    // out but don't reconcile (gap beyond the same per-round tolerance the
    // /transfers "OK" column uses). Absolute so an overpaid round can't cancel
    // an underpaid one; per-round filter so a hundred within-tolerance rounds
    // don't accumulate into a false warning.
    const [gap] = (
      await this.database.execute(sql`
      WITH per_transfer AS (
        SELECT dt.id,
          (SELECT coalesce(sum(od.amount), 0) FROM organization_donations od
             JOIN donations d ON d.id = od.donation_id
             WHERE d.donation_transfer_id = dt.id AND d.finalized = true) AS owed,
          (SELECT coalesce(sum(abs(bt.amount)), 0) FROM bank_transactions bt
             WHERE bt.donation_transfer_id = dt.id) AS paid_out,
          (SELECT count(*) FROM bank_transactions bt
             WHERE bt.donation_transfer_id = dt.id) AS payment_count
        FROM donation_transfers dt
      )
      SELECT cast(coalesce(sum(abs(owed - paid_out)) filter (
        where payment_count > 0
          and abs(owed - paid_out) > greatest(1000, round(abs(owed) * 0.005))
      ), 0) as int) as gap
      FROM per_transfer
    `)
    ).rows as Record<string, unknown>[];

    const received = num(bank?.received);
    const cardPayoutNet = num(bank?.card_payout_net);
    const cardFees = num(bank?.card_fees);
    const allocated = num(alloc?.allocated);

    return {
      dateFrom,
      dateTo,
      received,
      cardPayoutNet,
      cardPayoutGross: num(bank?.card_payout_gross),
      cardFees,
      cardFeesFromDonations: num(feeAgg?.fee),
      allocated,
      transferred: num(alloc?.transferred),
      transferPaidOut: num(bank?.transfer_paid_out),
      transferGap: num(gap?.gap),
      notYetTransferred: num(notYet?.total),
      undecidedInflow: num(bank?.undecided_inflow),
      outgoingTotal: num(bank?.outgoing_total),
      pendingLinkedCents: num(bank?.pending_linked_total),
      unimportedRows: num(stubs?.cnt),
      unlinkedDonationCount: num(unlinked?.cnt),
      unlinkedDonationCents: num(unlinked?.total),
      discrepancy: allocated - (received + cardPayoutNet + cardFees),
    };
  }
}

export const bankTransactionsRepository = new BankTransactionsRepository();
