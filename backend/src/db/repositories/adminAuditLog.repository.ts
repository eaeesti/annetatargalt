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
}

export const adminAuditLogRepository = new AdminAuditLogRepository();
