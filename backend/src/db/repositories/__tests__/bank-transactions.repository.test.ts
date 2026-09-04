/**
 * Integration tests for BankTransactionsRepository — upsert precedence, the
 * money-flow summary, and the paginated ledger with its computed columns.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { bankTransactionsRepository } from "../bank-transactions.repository";
import { donationsRepository } from "../donations.repository";
import {
  cleanDatabase,
  createTestDonor,
  createTestDonation,
  createTestOrganizationDonation,
  createTestDonationTransfer,
  createTestBankTransaction,
} from "../../__tests__/test-db-helper";

describe("BankTransactionsRepository", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("upsertMany", () => {
    it("reports only newly-inserted rows (0 on a no-op re-run)", async () => {
      const first = await bankTransactionsRepository.upsertMany([
        { archivingCode: "AAA", category: "undecided", amountCents: 500 },
        { archivingCode: "BBB", category: "ignored", amountCents: 700 },
      ]);
      expect(first).toBe(2);
      expect(await bankTransactionsRepository.ignoredCodes()).toEqual(
        new Set(["BBB"]),
      );

      const second = await bankTransactionsRepository.upsertMany([
        { archivingCode: "AAA", category: "undecided", amountCents: 500 },
        { archivingCode: "BBB", category: "ignored", amountCents: 700 },
        { archivingCode: "CCC", category: "undecided", amountCents: 900 },
      ]);
      expect(second).toBe(1); // only CCC is new
    });

    it("counts a migration stub given a real category as newly written", async () => {
      await bankTransactionsRepository.upsertMany([
        { archivingCode: "S1", category: "unimported" },
        { archivingCode: "S2", category: "unimported" },
      ]);
      const changed = await bankTransactionsRepository.upsertMany([
        { archivingCode: "S1", category: "donation", amountCents: 1000 },
        { archivingCode: "S2", category: "unimported" }, // still a stub
      ]);
      expect(changed).toBe(1); // S1 went stub → donation
      expect(await bankTransactionsRepository.unimportedCodes()).toEqual(
        new Set(["S2"]),
      );
    });

    it("chunks large batches (stays under the bind-parameter limit)", async () => {
      const rows = Array.from({ length: 6000 }, (_, i) => ({
        archivingCode: `BIG${i}`,
        category: "undecided" as const,
        amountCents: 100 + i,
        date: "2026-01-01",
      }));
      const inserted = await bankTransactionsRepository.upsertMany(rows);
      expect(inserted).toBe(6000);
      const { total } = await bankTransactionsRepository.findPaginated({
        page: 1,
        pageSize: 0,
      });
      expect(total).toBe(6000);
    });

    it("never lowers a category's precedence on re-upload", async () => {
      await bankTransactionsRepository.upsertMany([
        { archivingCode: "C", category: "donation", amountCents: 1000 },
      ]);
      // a later statement re-sees the line but the operator does nothing with it
      await bankTransactionsRepository.upsertMany([
        { archivingCode: "C", category: "undecided", amountCents: 1000 },
      ]);
      const [row] = await bankTransactionsRepository.findAll();
      expect(row.category).toBe("donation");
    });

    it("a migration stub ('unimported') is overwritten by any real import", async () => {
      await bankTransactionsRepository.upsertMany([
        { archivingCode: "STUB", category: "unimported" },
      ]);
      // the real statement line turns out to be a card payout
      await bankTransactionsRepository.upsertMany([
        {
          archivingCode: "STUB",
          category: "card-payout",
          date: "2026-05-11",
          amountCents: 29263,
          grossAmountCents: 30000,
          feeAmountCents: 737,
        },
      ]);
      const [row] = await bankTransactionsRepository.findAll();
      expect(row.category).toBe("card-payout");
      expect(row.feeAmount).toBe(737);
    });

    it("a heuristic re-upload does NOT un-ignore a code", async () => {
      await bankTransactionsRepository.upsertMany([
        { archivingCode: "D", category: "ignored" },
      ]);
      // a later import's looksLikeCardPayout heuristic fires — must not win
      await bankTransactionsRepository.upsertMany([
        { archivingCode: "D", category: "card-payout", amountCents: 4200 },
      ]);
      const [row] = await bankTransactionsRepository.findAll();
      expect(row.category).toBe("ignored");
      expect(row.amount).toBe(4200); // bank fields still coalesced
    });

    it("an explicit reclassify DOES un-ignore a code", async () => {
      await bankTransactionsRepository.upsertMany([
        { archivingCode: "D2", category: "ignored" },
      ]);
      await bankTransactionsRepository.upsertMany([
        {
          archivingCode: "D2",
          category: "donation",
          amountCents: 4200,
          reclassify: true,
        },
      ]);
      const [row] = await bankTransactionsRepository.findAll();
      expect(row.category).toBe("donation");
    });

    it("coalesces bank fields — a real line fills in a blind ignore", async () => {
      await bankTransactionsRepository.upsertMany([
        { archivingCode: "E", category: "ignored", note: "misdirected" },
      ]);
      await bankTransactionsRepository.upsertMany([
        {
          archivingCode: "E",
          category: "undecided",
          date: "2026-03-03",
          amountCents: 999,
          counterpartyName: "Someone",
        },
      ]);
      const [row] = await bankTransactionsRepository.findAll();
      expect(row.category).toBe("ignored");
      expect(row.date).toBe("2026-03-03");
      expect(row.amount).toBe(999);
      expect(row.note).toBe("misdirected");
    });

    it("stores card-payout gross/fee", async () => {
      await bankTransactionsRepository.upsertMany([
        {
          archivingCode: "PAYOUT",
          category: "card-payout",
          amountCents: 29263,
          grossAmountCents: 30000,
          feeAmountCents: 737,
        },
      ]);
      const [row] = await bankTransactionsRepository.findAll();
      expect(row.grossAmount).toBe(30000);
      expect(row.feeAmount).toBe(737);
    });
  });

  describe("setCategory", () => {
    it("refuses to un-donation a code with linked donations", async () => {
      await createTestBankTransaction({
        archivingCode: "LINKED",
        category: "donation",
        amount: 1000,
      });
      const d = await createTestDonation({ amount: 1000, finalized: true });
      await donationsRepository.setTransactionId(d.id, "LINKED", "manual");

      const res = await bankTransactionsRepository.setCategory(
        "LINKED",
        "ignored",
        null,
        "tester",
      );
      expect(res).toEqual({ ok: false, reason: "has-donations" });
    });

    it("refuses to un-donation a code with a still-pending donation", async () => {
      await createTestBankTransaction({
        archivingCode: "PENDING",
        category: "donation",
        amount: 1000,
      });
      const d = await createTestDonation({ amount: 1000, finalized: false });
      await donationsRepository.setTransactionId(d.id, "PENDING", "manual");

      const res = await bankTransactionsRepository.setCategory(
        "PENDING",
        "ignored",
        null,
        "tester",
      );
      expect(res).toEqual({ ok: false, reason: "has-donations" });
    });

    it("allows donation ↔ card-payout even with linked donations", async () => {
      await createTestBankTransaction({
        archivingCode: "SWAP",
        category: "donation",
        amount: 1000,
      });
      const d = await createTestDonation({ amount: 1000, finalized: true });
      await donationsRepository.setTransactionId(d.id, "SWAP", "manual");

      const res = await bankTransactionsRepository.setCategory(
        "SWAP",
        "card-payout",
        null,
        "tester",
      );
      expect(res.ok).toBe(true);
    });

    it("allows reclassifying an unlinked code", async () => {
      await createTestBankTransaction({
        archivingCode: "FREE",
        category: "undecided",
        amount: 200,
      });
      const res = await bankTransactionsRepository.setCategory(
        "FREE",
        "ignored",
        "interest",
        "tester",
      );
      expect(res.ok).toBe(true);
      expect(await bankTransactionsRepository.ignoredCodes()).toEqual(
        new Set(["FREE"]),
      );
    });

    it("returns not-found for an unknown code", async () => {
      const res = await bankTransactionsRepository.setCategory(
        "NOPE",
        "ignored",
        null,
        "t",
      );
      expect(res).toEqual({ ok: false, reason: "not-found" });
    });
  });

  describe("findPaginated", () => {
    it("computes linked donation count / allocated / balanced", async () => {
      const donor = await createTestDonor();
      await createTestBankTransaction({
        archivingCode: "BT1",
        category: "donation",
        date: "2026-02-10",
        amount: 5000,
      });
      const d = await createTestDonation({
        donorId: donor.id,
        amount: 5000,
        finalized: true,
      });
      await donationsRepository.setTransactionId(d.id, "BT1", "manual");
      await createTestOrganizationDonation({
        donationId: d.id,
        organizationInternalId: "AMF",
        amount: 5000,
      });

      const { data, total } = await bankTransactionsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(total).toBe(1);
      expect(data[0].linkedDonationCount).toBe(1);
      expect(data[0].allocatedCents).toBe(5000);
      expect(data[0].linkedGrossCents).toBe(5000);
      expect(data[0].balanced).toBe(true);
    });

    it("balanced is null while a linked donation is still pending", async () => {
      await createTestBankTransaction({
        archivingCode: "PB",
        category: "card-payout",
        amount: 4900,
        feeAmount: 100,
      });
      const done = await createTestDonation({ amount: 3000, finalized: true });
      const pending = await createTestDonation({
        amount: 2000,
        finalized: false,
      });
      await donationsRepository.setTransactionId(done.id, "PB", "card-payout");
      await donationsRepository.setTransactionId(
        pending.id,
        "PB",
        "card-payout",
      );

      const { data } = await bankTransactionsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      const row = data.find((r) => r.archivingCode === "PB")!;
      expect(row.linkedDonationCount).toBe(2); // both counted now
      expect(row.linkedGrossCents).toBe(5000);
      expect(row.balanced).toBeNull();
    });

    it("findByCodeWithDonations returns the row with its linked donations", async () => {
      const donor = await createTestDonor();
      await createTestBankTransaction({
        archivingCode: "WD",
        category: "donation",
        amount: 2000,
      });
      const d = await createTestDonation({
        donorId: donor.id,
        amount: 2000,
        finalized: true,
      });
      await donationsRepository.setTransactionId(d.id, "WD", "manual");
      await createTestOrganizationDonation({
        donationId: d.id,
        organizationInternalId: "AMF",
        amount: 2000,
      });

      const row =
        await bankTransactionsRepository.findByCodeWithDonations("WD");
      expect(row?.category).toBe("donation");
      expect(row?.donations).toHaveLength(1);
      expect(row?.donations[0].id).toBe(d.id);
      expect(row?.donations[0].organizationDonations).toHaveLength(1);
    });

    it("filters by category", async () => {
      await createTestBankTransaction({
        archivingCode: "X1",
        category: "ignored",
      });
      await createTestBankTransaction({
        archivingCode: "X2",
        category: "undecided",
      });
      const { data } = await bankTransactionsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        category: "ignored",
      });
      expect(data.map((r) => r.archivingCode)).toEqual(["X1"]);
    });

    it("pageSize <= 0 returns every row", async () => {
      for (let i = 0; i < 12; i++) {
        await createTestBankTransaction({
          archivingCode: `P${i}`,
          category: "undecided",
          date: `2026-01-${String(i + 1).padStart(2, "0")}`,
        });
      }
      const { data, total } = await bankTransactionsRepository.findPaginated({
        page: 1,
        pageSize: 0,
      });
      expect(total).toBe(12);
      expect(data).toHaveLength(12);
    });
  });

  describe("moneyFlow", () => {
    it("sums received / card fees / allocated / transferred and flags no discrepancy", async () => {
      const donor = await createTestDonor();

      // a plain bank donation: bank received 5000, allocated 5000
      await createTestBankTransaction({
        archivingCode: "M1",
        category: "donation",
        date: "2026-04-01",
        amount: 5000,
      });
      const d1 = await createTestDonation({
        donorId: donor.id,
        amount: 5000,
        finalized: true,
      });
      await donationsRepository.setTransactionId(d1.id, "M1", "manual");
      await createTestOrganizationDonation({
        donationId: d1.id,
        organizationInternalId: "AMF",
        amount: 5000,
      });

      // a card payout: bank received 9263 net, fee 737, donations gross 10000
      await createTestBankTransaction({
        archivingCode: "M2",
        category: "card-payout",
        date: "2026-04-05",
        amount: 9263,
        grossAmount: 10000,
        feeAmount: 737,
      });
      const transfer = await createTestDonationTransfer({});
      const d2 = await createTestDonation({
        donorId: donor.id,
        amount: 10000,
        finalized: true,
        donationTransferId: transfer.id,
      });
      await donationsRepository.setTransactionId(d2.id, "M2", "card-payout");
      await donationsRepository.setProcessorFee(d2.id, 737);
      await createTestOrganizationDonation({
        donationId: d2.id,
        organizationInternalId: "GD",
        amount: 10000,
      });

      // an undecided inflow
      await createTestBankTransaction({
        archivingCode: "M3",
        category: "undecided",
        date: "2026-04-10",
        amount: 1234,
      });

      // an outgoing debit (transfer to an org)
      await createTestBankTransaction({
        archivingCode: "M4",
        category: "outgoing",
        date: "2026-04-20",
        amount: 20000,
      });

      // an unlinked finalized donation (money in the ledger, no bank line)
      await createTestDonation({ amount: 800, finalized: true });

      const mf = await bankTransactionsRepository.moneyFlow({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(mf.received).toBe(5000);
      expect(mf.cardPayoutNet).toBe(9263);
      expect(mf.cardPayoutGross).toBe(10000);
      expect(mf.cardFees).toBe(737);
      expect(mf.cardFeesFromDonations).toBe(737);
      expect(mf.allocated).toBe(15000);
      expect(mf.transferred).toBe(10000);
      expect(mf.undecidedInflow).toBe(1234);
      expect(mf.outgoingTotal).toBe(20000);
      expect(mf.unlinkedDonationCount).toBe(1);
      expect(mf.unlinkedDonationCents).toBe(800);
      expect(mf.pendingLinkedCents).toBe(0);
      // allocated 15000 − (received 5000 + net 9263 + fee 737) = 0
      expect(mf.discrepancy).toBe(0);
    });

    it("excludes a donation-category bank row from received while its linked donation is still pending", async () => {
      const donor = await createTestDonor();
      await createTestBankTransaction({
        archivingCode: "PEND",
        category: "donation",
        date: "2026-06-01",
        amount: 7500,
      });
      const d = await createTestDonation({
        donorId: donor.id,
        amount: 7500,
        finalized: false,
      });
      await donationsRepository.setTransactionId(d.id, "PEND", "manual");

      const mf = await bankTransactionsRepository.moneyFlow({
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
      });
      expect(mf.received).toBe(0); // not counted until the donation finalizes
      expect(mf.allocated).toBe(0);
      expect(mf.discrepancy).toBe(0); // both sides excluded — no false red
      expect(mf.pendingLinkedCents).toBe(7500);
    });

    it("respects the date range", async () => {
      await createTestBankTransaction({
        archivingCode: "IN",
        category: "donation",
        date: "2026-05-15",
        amount: 100,
      });
      await createTestBankTransaction({
        archivingCode: "OUT",
        category: "donation",
        date: "2026-07-15",
        amount: 999,
      });
      const mf = await bankTransactionsRepository.moneyFlow({
        dateFrom: "2026-05-01",
        dateTo: "2026-05-31",
      });
      expect(mf.received).toBe(100);
    });

    it("migration stubs ('unimported', null amount) don't inflate the discrepancy", async () => {
      const donor = await createTestDonor();
      // simulate post-migration state: a finalized donation linked to a stub row
      await bankTransactionsRepository.upsertMany([
        { archivingCode: "STUB1", category: "unimported" },
      ]);
      const d = await createTestDonation({
        donorId: donor.id,
        amount: 5000,
        finalized: true,
      });
      await donationsRepository.setTransactionId(d.id, "STUB1", "manual");
      await createTestOrganizationDonation({
        donationId: d.id,
        organizationInternalId: "AMF",
        amount: 5000,
      });

      const mf = await bankTransactionsRepository.moneyFlow({});
      expect(mf.received).toBe(0);
      expect(mf.allocated).toBe(0); // stub excluded from both sides
      expect(mf.discrepancy).toBe(0);
      expect(mf.unimportedRows).toBe(1);
    });
  });
});
