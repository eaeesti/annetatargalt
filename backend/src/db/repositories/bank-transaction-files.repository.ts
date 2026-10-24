import { eq, inArray } from "drizzle-orm";
import { db, type Database } from "../client";
import {
  bankTransactionFiles,
  type BankTransactionFile,
  type NewBankTransactionFile,
} from "../schema";

/** What the admin panel shows of an attached file. */
export interface FileSummary {
  id: number;
  fileName: string;
  sizeBytes: number;
  uploadedAt: Date;
}

const summary = {
  id: bankTransactionFiles.id,
  fileName: bankTransactionFiles.fileName,
  sizeBytes: bankTransactionFiles.sizeBytes,
  uploadedAt: bankTransactionFiles.uploadedAt,
};

export class BankTransactionFilesRepository {
  constructor(private database: Database = db) {}

  /**
   * Records the line's file. Null when the line already has one: a line has
   * at most one file.
   */
  async create(row: NewBankTransactionFile): Promise<FileSummary | null> {
    const [created] = await this.database
      .insert(bankTransactionFiles)
      .values(row)
      .onConflictDoNothing({ target: bankTransactionFiles.archivingCode })
      .returning(summary);
    return created ?? null;
  }

  /** The line's file, if it has one. */
  async findByCode(archivingCode: string): Promise<FileSummary | undefined> {
    const [row] = await this.database
      .select(summary)
      .from(bankTransactionFiles)
      .where(eq(bankTransactionFiles.archivingCode, archivingCode));
    return row;
  }

  async findById(id: number): Promise<BankTransactionFile | undefined> {
    const [row] = await this.database
      .select()
      .from(bankTransactionFiles)
      .where(eq(bankTransactionFiles.id, id));
    return row;
  }

  /** Each line's file. Lines without one are left out. */
  async findForCodes(codes: string[]): Promise<Map<string, FileSummary>> {
    if (codes.length === 0) return new Map();
    const rows = await this.database
      .select({ ...summary, archivingCode: bankTransactionFiles.archivingCode })
      .from(bankTransactionFiles)
      .where(inArray(bankTransactionFiles.archivingCode, codes));
    return new Map(
      rows.map(({ archivingCode, ...file }) => [archivingCode, file]),
    );
  }

  /** Deletes the row and returns it, so its file can be removed too. */
  async delete(id: number): Promise<BankTransactionFile | undefined> {
    const [row] = await this.database
      .delete(bankTransactionFiles)
      .where(eq(bankTransactionFiles.id, id))
      .returning();
    return row;
  }
}

export const bankTransactionFilesRepository =
  new BankTransactionFilesRepository();
