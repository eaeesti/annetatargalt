import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type Database } from "../client";
import { adminAuditLog } from "../schema";

export class AdminAuditLogRepository {
  constructor(private database: Database = db) {}

  async log(entry: {
    userId: string;
    userEmail: string;
    action: string;
    recordId?: string | null;
    ip?: string | null;
  }): Promise<void> {
    await this.database.insert(adminAuditLog).values(entry);
  }

  /**
   * Whether the same person logged the same action on the same record in
   * the last `minutes`. Compared with the database's own clock, which wrote
   * the entries' times.
   */
  async loggedWithin(
    entry: { userId: string; action: string; recordId: string | null },
    minutes: number,
  ): Promise<boolean> {
    const [found] = await this.database
      .select({ id: adminAuditLog.id })
      .from(adminAuditLog)
      .where(
        and(
          eq(adminAuditLog.userId, entry.userId),
          eq(adminAuditLog.action, entry.action),
          entry.recordId === null
            ? isNull(adminAuditLog.recordId)
            : eq(adminAuditLog.recordId, entry.recordId),
          sql`${adminAuditLog.timestamp} > now() - make_interval(mins => ${minutes})`,
        ),
      )
      .limit(1);
    return Boolean(found);
  }
}

export const adminAuditLogRepository = new AdminAuditLogRepository();
