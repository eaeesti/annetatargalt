import { db, type Database } from "../client";
import { senderDonorAliases, type SenderDonorAlias } from "../schema";

export class SenderDonorAliasesRepository {
  constructor(private database: Database = db) {}

  async findAll(): Promise<SenderDonorAlias[]> {
    return this.database.query.senderDonorAliases.findMany({
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
  }

  /** sender code → donor id */
  async map(): Promise<Map<string, number>> {
    const rows = await this.database
      .select({
        code: senderDonorAliases.senderCode,
        donorId: senderDonorAliases.donorId,
      })
      .from(senderDonorAliases);
    return new Map(rows.map((r) => [r.code, r.donorId]));
  }

  /** Idempotent per sender code; re-adding updates the donor. */
  async add(
    rows: {
      senderCode: string;
      donorId: number;
      note?: string | null;
      createdBy?: string | null;
    }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    for (const r of rows) {
      await this.database
        .insert(senderDonorAliases)
        .values({
          senderCode: r.senderCode,
          donorId: r.donorId,
          note: r.note ?? null,
          createdBy: r.createdBy ?? null,
        })
        .onConflictDoUpdate({
          target: senderDonorAliases.senderCode,
          set: { donorId: r.donorId, note: r.note ?? null },
        });
    }
  }
}

export const senderDonorAliasesRepository = new SenderDonorAliasesRepository();
