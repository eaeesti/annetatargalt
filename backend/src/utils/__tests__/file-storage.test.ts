import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, stat, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FileStorageUnavailableError,
  readStoredFile,
  removeStoredFile,
  saveFile,
  storageRoot,
} from "../file-storage";

describe("storageRoot", () => {
  it("uses the configured folder", () => {
    expect(
      storageRoot({ FILE_STORAGE_DIR: "/srv/files", NODE_ENV: "production" }),
    ).toBe("/srv/files");
  });

  it("has no fallback in production", () => {
    expect(() => storageRoot({ NODE_ENV: "production" })).toThrow(
      FileStorageUnavailableError,
    );
    expect(() =>
      storageRoot({ FILE_STORAGE_DIR: "  ", NODE_ENV: "production" }),
    ).toThrow(FileStorageUnavailableError);
  });

  it("falls back to a folder git ignores in development", () => {
    expect(storageRoot({ NODE_ENV: "development" })).toBe(
      path.resolve(".tmp", "file-storage"),
    );
  });
});

describe("stored files", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "file-storage-test-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("saves, reads and removes a file", async () => {
    const data = Buffer.from("%PDF-1.7 test");
    const key = await saveFile("receipts", data, root);

    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(await readStoredFile("receipts", key, root)).toEqual(data);

    await removeStoredFile("receipts", key, root);
    expect(await readStoredFile("receipts", key, root)).toBeNull();
  });

  it("gives each file its own key", async () => {
    const data = Buffer.from("same content");
    const first = await saveFile("receipts", data, root);
    const second = await saveFile("receipts", data, root);
    expect(first).not.toBe(second);
    expect(await readdir(path.join(root, "receipts"))).toHaveLength(2);
  });

  it("keeps files readable by the server's user only", async () => {
    const key = await saveFile("receipts", Buffer.from("x"), root);
    const file = await stat(path.join(root, "receipts", key));
    const folder = await stat(path.join(root, "receipts"));
    expect(file.mode & 0o777).toBe(0o600);
    expect(folder.mode & 0o777).toBe(0o700);
  });

  it("treats a file that's already gone as removed", async () => {
    await expect(
      removeStoredFile("receipts", "0".repeat(32), root),
    ).resolves.toBeUndefined();
    expect(await readStoredFile("receipts", "0".repeat(32), root)).toBeNull();
  });

  it("refuses keys and folders that could lead outside the root", async () => {
    await expect(readStoredFile("receipts", "../secret", root)).rejects.toThrow(
      "Invalid storage key",
    );
    await expect(
      readStoredFile("../etc", "0".repeat(32), root),
    ).rejects.toThrow("Invalid storage folder");
    await expect(
      saveFile("receipts/../..", Buffer.from("x"), root),
    ).rejects.toThrow("Invalid storage folder");
  });
});
