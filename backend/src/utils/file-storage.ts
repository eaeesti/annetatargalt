/**
 * Private files on the server's own disk, such as the PDFs attached to bank
 * lines. They're kept outside the app's folder, so a deploy never touches
 * them, and are backed up with the databases.
 *
 * Each file is stored under a random key in a folder per kind. What a file is
 * called and what it belongs to lives in the database, never in its name.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Thrown when production has no storage folder configured. */
export class FileStorageUnavailableError extends Error {
  constructor() {
    super("File storage isn't configured on this server");
  }
}

const KEY = /^[0-9a-f]{32}$/;
const FOLDER = /^[a-z][a-z-]*$/;

/**
 * Where files are kept: FILE_STORAGE_DIR, or in development a folder git
 * ignores. Production has no fallback, since anything inside the app's own
 * folder is the deploy's to replace.
 */
export function storageRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.FILE_STORAGE_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (env.NODE_ENV === "production") throw new FileStorageUnavailableError();
  return path.resolve(".tmp", "file-storage");
}

function filePath(root: string, folder: string, key: string): string {
  // both are checked, so neither can lead outside the root
  if (!FOLDER.test(folder)) throw new Error(`Invalid storage folder ${folder}`);
  if (!KEY.test(key)) throw new Error("Invalid storage key");
  return path.join(root, folder, key);
}

function isMissing(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err.code === "ENOENT" || err.code === "ENOTDIR")
  );
}

/** Stores `data` and returns its key. */
export async function saveFile(
  folder: string,
  data: Buffer,
  root = storageRoot(),
): Promise<string> {
  const key = randomBytes(16).toString("hex");
  const target = filePath(root, folder, key);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  // "wx": never overwrite, even on the off chance two keys collide
  await writeFile(target, data, { flag: "wx", mode: 0o600 });
  return key;
}

/** The stored file, or null when it isn't on disk. */
export async function readStoredFile(
  folder: string,
  key: string,
  root = storageRoot(),
): Promise<Buffer | null> {
  try {
    return await readFile(filePath(root, folder, key));
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

/** Removes the stored file; one that's already gone is fine. */
export async function removeStoredFile(
  folder: string,
  key: string,
  root = storageRoot(),
): Promise<void> {
  try {
    await unlink(filePath(root, folder, key));
  } catch (err) {
    if (!isMissing(err)) throw err;
  }
}
