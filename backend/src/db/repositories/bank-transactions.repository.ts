import { eq, inArray, sql } from "drizzle-orm";
import { db, type Database } from "../client";
import { bankTransactions, type BankTransaction } from "../schema";

export type BankTransactionCategory =
  | "donation"
  | "card-payout"
  | "ignored"
  | "undecided";

/** Higher wins when an upload's decision meets an existing row. */
const CATEGORY_PRECEDENCE: Record<string, number> = {
  donation: 3,
  "card-payout": 2,
  ignored: 1,
  undecided: 0,
};
const prec = (c: string) => CATEGORY_PRECEDENCE[c] ?? 0;

const trunc = (v: string | null | undefined, n: number) =>
  v == null ? null : v.slice(0, n);

export interface BankTransactionUpsert {
  archivingCode: string;
  date?: string | null; // YYYY-MM-DD
  amountCents?: number | null;
  description?: string | null;
  counterpartyName?: string | null;
  counterpartyAccount?: string | null;
  senderCode?: string | null;
  category: BankTransactionCategory;
  note?: string | null;
  importedBy?: string | null;
  grossAmountCents?: number | null; // card payouts only
  feeAmountCents?: number | null; // card payouts only
}

export interface BankTransactionRow extends BankTransaction {
  /** finalized donations carrying this archiving code */
  linkedDonationCount: number;
  /** Σ organization_donations.amount for those donations */
  allocatedCents: number;
  /** Σ donation.amount (gross) for those donations */
  linkedGrossCents: number;
  /** bank `amount` ≈ linked gross − fee, within rounding */
  balanced: boolean;
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
  /** …of which the donation is already in a donation_transfer */
  transferred: number;
  /** Σ amount, category = 'undecided' */
  undecidedInflow: number;
  /** finalized donations with no transaction_id at all (standing backlog, not date-filtered) */
  unlinkedDonationCount: number;
  unlinkedDonationCents: number;
  /** allocated − (received + cardPayoutNet + cardFees) — should be ~0 */
  discrepancy: number;
}

interface FindPaginatedOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

const num = (v: unknown) => Number(v ?? 0);

function mapRow(r: Record<string, unknown>): BankTransactionRow {
  const amount = r.amount == null ? null : num(r.amount);
  const feeAmount = r.fee_amount == null ? null : num(r.fee_amount);
  const linkedDonationCount = num(r.linked_donation_count);
  const linkedGrossCents = num(r.linked_gross_cents);
  const expectedNet = linkedGrossCents - (feeAmount ?? 0);
  const balanced =
    linkedDonationCount > 0 &&
    amount != null &&
    Math.abs(amount - expectedNet) <= Math.max(1, linkedDonationCount);

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

  async findAll(): Promise<BankTransaction[]> {
    return this.database.query.bankTransactions.findMany({
      orderBy: (t, { desc }) => [desc(t.date)],
    });
  }

  /**
   * Idempotent upsert of statement credit lines. Bank fields are refreshed
   * (coalesced — a real line fills in a blind ignore); `category` never drops
   * below what's already recorded (precedence donation > card-payout > ignored >
   * undecided), so a re-upload can't silently un-ignore or un-link a code.
   * Returns the number of distinct codes touched.
   */
  async upsertMany(rows: BankTransactionUpsert[]): Promise<number> {
    if (rows.length === 0) return 0;

    // dedupe input by code — higher-precedence category wins
    const byCode = new Map<string, BankTransactionUpsert>();
    for (const r of rows) {
      const archivingCode = r.archivingCode.slice(0, 20);
      const prev = byCode.get(archivingCode);
      if (!prev || prec(r.category) >= prec(prev.category)) {
        byCode.set(archivingCode, { ...r, archivingCode });
      }
    }
    const deduped = [...byCode.values()];

    const existing = await this.database
      .select({
        code: bankTransactions.archivingCode,
        category: bankTransactions.category,
      })
      .from(bankTransactions)
      .where(
        inArray(
          bankTransactions.archivingCode,
          deduped.map((r) => r.archivingCode),
        ),
      );
    const existingCat = new Map(existing.map((e) => [e.code, e.category]));

    // group by the resolved final category — one upsert statement per group
    const groups = new Map<string, BankTransactionUpsert[]>();
    for (const r of deduped) {
      const cur = existingCat.get(r.archivingCode);
      const finalCat = cur && prec(cur) > prec(r.category) ? cur : r.category;
      const arr = groups.get(finalCat) ?? [];
      arr.push(r);
      groups.set(finalCat, arr);
    }

    for (const [finalCat, groupRows] of groups) {
      await this.database
        .insert(bankTransactions)
        .values(
          groupRows.map((r) => ({
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
            date: sql`coalesce(excluded."date", ${bankTransactions.date})`,
            amount: sql`coalesce(excluded."amount", ${bankTransactions.amount})`,
            description: sql`coalesce(excluded."description", ${bankTransactions.description})`,
            counterpartyName: sql`coalesce(excluded."counterparty_name", ${bankTransactions.counterpartyName})`,
            counterpartyAccount: sql`coalesce(excluded."counterparty_account", ${bankTransactions.counterpartyAccount})`,
            senderCode: sql`coalesce(excluded."sender_code", ${bankTransactions.senderCode})`,
            category: finalCat,
            grossAmount: sql`coalesce(excluded."gross_amount", ${bankTransactions.grossAmount})`,
            feeAmount: sql`coalesce(excluded."fee_amount", ${bankTransactions.feeAmount})`,
            note: sql`coalesce(excluded."note", ${bankTransactions.note})`,
            importedBy: sql`coalesce(excluded."imported_by", ${bankTransactions.importedBy})`,
            importedAt: sql`now()`,
            updatedAt: sql`now()`,
          },
        });
    }

    return deduped.length;
  }

  /**
   * Reclassify one code from the /transactions UI. Refuses to move a code away
   * from 'donation' while finalized donations still reference it.
   */
  async setCategory(
    code: string,
    category: BankTransactionCategory,
    note: string | null,
    by: string | null,
  ): Promise<{ ok: boolean; reason?: "not-found" | "has-donations" }> {
    if (category !== "donation") {
      const [linked] = await this.database
        .execute(
          sql`SELECT cast(count(*) as int) as n FROM donations WHERE transaction_id = ${code} AND finalized = true`,
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
      date: sql`bt.date`,
      amount: sql`bt.amount`,
      category: sql`bt.category`,
      counterpartyName: sql`bt.counterparty_name`,
      importedAt: sql`bt.imported_at`,
    };
    const sortCol = sortCols[sortBy] ?? sql`bt.date`;
    const dir = sortDir === "asc" ? sql`asc` : sql`desc`;

    const rowsRes = await this.database.execute(sql`
      SELECT bt.*,
        (SELECT cast(count(*) as int) FROM donations d
           WHERE d.transaction_id = bt.archiving_code AND d.finalized = true) as linked_donation_count,
        (SELECT cast(coalesce(sum(od.amount), 0) as int)
           FROM organization_donations od
           JOIN donations d ON d.id = od.donation_id
           WHERE d.transaction_id = bt.archiving_code AND d.finalized = true) as allocated_cents,
        (SELECT cast(coalesce(sum(d.amount), 0) as int) FROM donations d
           WHERE d.transaction_id = bt.archiving_code AND d.finalized = true) as linked_gross_cents
      FROM bank_transactions bt
      WHERE ${where}
      ORDER BY ${sortCol} ${dir} NULLS LAST, bt.archiving_code ${dir}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `);
    const countRes = await this.database.execute(
      sql`SELECT cast(count(*) as int) as total FROM bank_transactions bt WHERE ${where}`,
    );

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

    const [bank] = (
      await this.database.execute(sql`
      SELECT
        cast(coalesce(sum(bt.amount) filter (where bt.category = 'donation'), 0) as int) as received,
        cast(coalesce(sum(bt.amount) filter (where bt.category = 'card-payout'), 0) as int) as card_payout_net,
        cast(coalesce(sum(coalesce(bt.gross_amount, bt.amount)) filter (where bt.category = 'card-payout'), 0) as int) as card_payout_gross,
        cast(coalesce(sum(bt.fee_amount) filter (where bt.category = 'card-payout'), 0) as int) as card_fees,
        cast(coalesce(sum(bt.amount) filter (where bt.category = 'undecided'), 0) as int) as undecided_inflow
      FROM bank_transactions bt
      WHERE bt.amount IS NOT NULL ${btDateClause}
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
      WHERE bt.category IN ('donation', 'card-payout') ${btDateClause}
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
      undecidedInflow: num(bank?.undecided_inflow),
      unlinkedDonationCount: num(unlinked?.cnt),
      unlinkedDonationCents: num(unlinked?.total),
      discrepancy: allocated - (received + cardPayoutNet + cardFees),
    };
  }
}

export const bankTransactionsRepository = new BankTransactionsRepository();
