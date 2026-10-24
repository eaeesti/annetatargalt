/**
 * The PDF attached to a bank line, such as a recipient's receipt for a
 * payment in a transfer round; a line has at most one. The rows are in the donations database and the files
 * on the server's disk.
 */
import type { Core } from "@strapi/strapi";
import {
  bankTransactionFilesRepository,
  bankTransactionsRepository,
  type FileSummary,
} from "../../../../db/repositories";
import {
  FileStorageUnavailableError,
  readStoredFile,
  removeStoredFile,
  saveFile,
  storageRoot,
} from "../../../../utils/file-storage";
import {
  cleanFileName,
  isPdf,
  MAX_PDF_BYTES,
} from "../../../../utils/pdf-file";

const FOLDER = "bank-transaction-files";

export type AttachFailure =
  | "not-found"
  | "not-linked"
  | "empty"
  | "too-large"
  | "not-pdf"
  | "has-file"
  | "storage-unavailable";

/** The storage folder, or null when the server has none configured. */
function availableRoot(): string | null {
  try {
    return storageRoot();
  } catch (err) {
    if (err instanceof FileStorageUnavailableError) return null;
    throw err;
  }
}

export function createBankTransactionFileService(strapi: Core.Strapi) {
  return {
    async attach(
      archivingCode: string,
      upload: { data: Buffer; fileName: string | null },
      uploadedBy: string,
    ): Promise<
      { ok: true; file: FileSummary } | { ok: false; reason: AttachFailure }
    > {
      const { data } = upload;
      if (data.length === 0) return { ok: false, reason: "empty" };
      if (data.length > MAX_PDF_BYTES)
        return { ok: false, reason: "too-large" };
      if (!isPdf(data)) return { ok: false, reason: "not-pdf" };

      const line =
        await bankTransactionsRepository.findByCodeWithDonations(archivingCode);
      if (!line) return { ok: false, reason: "not-found" };
      // files are the record of a payment in a transfer round
      if (line.donationTransferId === null) {
        return { ok: false, reason: "not-linked" };
      }

      // one file per line: replacing it means removing the old one first
      if (await bankTransactionFilesRepository.findByCode(archivingCode)) {
        return { ok: false, reason: "has-file" };
      }

      const root = availableRoot();
      if (!root) return { ok: false, reason: "storage-unavailable" };
      const storageKey = await saveFile(FOLDER, data, root);

      let file: FileSummary | null;
      try {
        file = await bankTransactionFilesRepository.create({
          archivingCode,
          storageKey,
          fileName: cleanFileName(upload.fileName),
          sizeBytes: data.length,
          uploadedBy: uploadedBy.slice(0, 256),
        });
      } catch (err) {
        await removeStoredFile(FOLDER, storageKey, root);
        throw err;
      }
      if (!file) {
        // another upload to the line got there first
        await removeStoredFile(FOLDER, storageKey, root);
        return { ok: false, reason: "has-file" };
      }
      return { ok: true, file };
    },

    async open(
      id: number,
    ): Promise<
      | { ok: true; fileName: string; data: Buffer }
      | { ok: false; reason: "not-found" | "missing" | "storage-unavailable" }
    > {
      const row = await bankTransactionFilesRepository.findById(id);
      if (!row) return { ok: false, reason: "not-found" };
      const root = availableRoot();
      if (!root) return { ok: false, reason: "storage-unavailable" };

      const data = await readStoredFile(FOLDER, row.storageKey, root);
      if (!data) {
        strapi.log.error(
          `Bank transaction file ${id} is in the database but not on disk`,
        );
        return { ok: false, reason: "missing" };
      }
      return { ok: true, fileName: row.fileName, data };
    },

    async remove(
      id: number,
    ): Promise<
      | { ok: true; archivingCode: string }
      | { ok: false; reason: "not-found" | "storage-unavailable" }
    > {
      const root = availableRoot();
      if (!root) return { ok: false, reason: "storage-unavailable" };

      // The row goes first. A file left without its row only takes up space,
      // while a row left without its file would list a PDF nobody can open.
      const row = await bankTransactionFilesRepository.delete(id);
      if (!row) return { ok: false, reason: "not-found" };
      try {
        await removeStoredFile(FOLDER, row.storageKey, root);
      } catch (err) {
        strapi.log.warn(
          `Bank transaction file ${id} was removed, but its file wasn't: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return { ok: true, archivingCode: row.archivingCode };
    },
  };
}
