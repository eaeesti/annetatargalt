import { inArray } from "drizzle-orm";
import { db, type Database } from "../client";
import {
  ignoredBankTransactions,
  type IgnoredBankTransaction,
} from "../schema";

export class IgnoredBankTransactionsRepository {
  constructor(private database: Database = db) {}

  async findAll(): Promise<IgnoredBankTransaction[]> {
    return this.database.query.ignoredBankTransactions.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }

  /** Set of archiving codes currently marked "not a donation". */
  async codes(): Promise<Set<string>> {
    const rows = await this.database
      .select({ code: ignoredBankTransactions.archivingCode })
      .from(ignoredBankTransactions);
    return new Set(rows.map((r) => r.code));
  }

  /** Idempotent — re-ignoring a code is a no-op. */
  async add(
    rows: {
      archivingCode: string;
      reason?: string | null;
      createdBy?: string | null;
    }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.database
      .insert(ignoredBankTransactions)
      .values(
        rows.map((r) => ({
          archivingCode: r.archivingCode,
          reason: r.reason ?? null,
          createdBy: r.createdBy ?? null,
        })),
      )
      .onConflictDoNothing();
  }

  async remove(archivingCodes: string[]): Promise<void> {
    if (archivingCodes.length === 0) return;
    await this.database
      .delete(ignoredBankTransactions)
      .where(inArray(ignoredBankTransactions.archivingCode, archivingCodes));
  }
}

export const ignoredBankTransactionsRepository =
  new IgnoredBankTransactionsRepository();
