/**
 * Integration tests for BankTransactionFilesRepository, and the file the
 * transfer page and the "link a payment" picker show with each payment.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { bankTransactionFilesRepository } from "../bank-transaction-files.repository";
import { bankTransactionsRepository } from "../bank-transactions.repository";
import { donationTransfersRepository } from "../donation-transfers.repository";
import {
  cleanDatabase,
  createTestBankTransaction,
  createTestDonationTransfer,
} from "../../__tests__/test-db-helper";

const file = (archivingCode: string, n: number) => ({
  archivingCode,
  storageKey: n.toString(16).padStart(32, "0"),
  fileName: `receipt-${n}.pdf`,
  sizeBytes: 1000 + n,
  uploadedBy: "test@example.com",
});

describe("BankTransactionFilesRepository", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("records a payment's file and finds it", async () => {
    await createTestBankTransaction({
      archivingCode: "OUT1",
      category: "outgoing",
    });
    const created = await bankTransactionFilesRepository.create(
      file("OUT1", 1),
    );

    expect(created).toMatchObject({
      fileName: "receipt-1.pdf",
      sizeBytes: 1001,
    });
    expect(await bankTransactionFilesRepository.findByCode("OUT1")).toEqual(
      created,
    );
    const found = await bankTransactionFilesRepository.findForCodes([
      "OUT1",
      "NONE",
    ]);
    expect(found.get("OUT1")).toEqual(created);
    expect(found.has("NONE")).toBe(false);
  });

  it("keeps a payment to one file", async () => {
    await createTestBankTransaction({
      archivingCode: "OUT1",
      category: "outgoing",
    });
    await createTestBankTransaction({
      archivingCode: "OUT2",
      category: "outgoing",
    });
    const first = await bankTransactionFilesRepository.create(file("OUT1", 1));

    expect(
      await bankTransactionFilesRepository.create(file("OUT1", 2)),
    ).toBeNull();
    expect(await bankTransactionFilesRepository.findByCode("OUT1")).toEqual(
      first,
    );
    // another payment still takes its own
    expect(
      await bankTransactionFilesRepository.create(file("OUT2", 3)),
    ).not.toBeNull();
  });

  it("deletes a row and hands it back, storage key included", async () => {
    await createTestBankTransaction({
      archivingCode: "OUT1",
      category: "outgoing",
    });
    const created = await bankTransactionFilesRepository.create(
      file("OUT1", 2),
    );
    if (!created) throw new Error("not created");

    const deleted = await bankTransactionFilesRepository.delete(created.id);
    expect(deleted?.storageKey).toBe(file("OUT1", 2).storageKey);
    expect(
      await bankTransactionFilesRepository.findById(created.id),
    ).toBeUndefined();
    expect(
      await bankTransactionFilesRepository.delete(created.id),
    ).toBeUndefined();
    // and the payment can take a file again
    expect(
      await bankTransactionFilesRepository.create(file("OUT1", 3)),
    ).not.toBeNull();
  });

  it("shows each linked payment's file on the transfer", async () => {
    const transfer = await createTestDonationTransfer({
      datetime: "2026-01-10",
    });
    await createTestBankTransaction({
      archivingCode: "OUT1",
      category: "outgoing",
      donationTransferId: transfer.id,
    });
    await createTestBankTransaction({
      archivingCode: "OUT2",
      category: "outgoing",
      donationTransferId: transfer.id,
    });
    const attached = await bankTransactionFilesRepository.create(
      file("OUT1", 1),
    );

    const r = await donationTransfersRepository.findByIdWithReconciliation(
      transfer.id,
    );
    const byCode = new Map(
      r?.linkedBankTransactions.map((p) => [p.archivingCode, p.file]),
    );
    expect(byCode.get("OUT1")).toEqual(attached);
    expect(byCode.get("OUT2")).toBeNull();
  });

  it("says in the picker which unlinked payments have a file", async () => {
    await createTestBankTransaction({
      archivingCode: "OUT1",
      category: "outgoing",
      date: "2026-01-12",
    });
    await createTestBankTransaction({
      archivingCode: "OUT2",
      category: "outgoing",
      date: "2026-01-13",
    });
    await bankTransactionFilesRepository.create(file("OUT1", 1));

    const rows = await bankTransactionsRepository.findUnlinkedOutgoing({});
    expect(rows.map((r) => [r.archivingCode, r.hasFile])).toEqual([
      ["OUT1", true],
      ["OUT2", false],
    ]);
  });
});
