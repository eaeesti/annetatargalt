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

    it("filters by the computed balanced state", async () => {
      // OK — amount matches linked gross
      await createTestBankTransaction({
        archivingCode: "OK1",
        category: "donation",
        amount: 5000,
      });
      const dOk = await createTestDonation({ amount: 5000, finalized: true });
      await donationsRepository.setTransactionId(dOk.id, "OK1", "manual");

      // Not OK — card payout net short of linked gross, no fee recorded
      await createTestBankTransaction({
        archivingCode: "BAD1",
        category: "card-payout",
        amount: 4900,
      });
      const dBad = await createTestDonation({ amount: 5000, finalized: true });
      await donationsRepository.setTransactionId(
        dBad.id,
        "BAD1",
        "card-payout",
      );

      // Unknown — no linked donations
      await createTestBankTransaction({
        archivingCode: "UNK1",
        category: "undecided",
        amount: 1000,
      });

      const ok = await bankTransactionsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        balanced: "ok",
      });
      expect(ok.data.map((r) => r.archivingCode)).toEqual(["OK1"]);

      const notOk = await bankTransactionsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        balanced: "not-ok",
      });
      expect(notOk.data.map((r) => r.archivingCode)).toEqual(["BAD1"]);

      const unknown = await bankTransactionsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        balanced: "unknown",
      });
      expect(unknown.data.map((r) => r.archivingCode)).toEqual(["UNK1"]);
    });
  });

  describe("card-fee backfill helpers", () => {
    it("cardPayoutsMissingFee returns only card payouts with no fee_amount", async () => {
      await createTestBankTransaction({
        archivingCode: "CP-NOFEE",
        category: "card-payout",
        amount: 9263,
        feeAmount: null,
      });
      await createTestBankTransaction({
        archivingCode: "CP-HASFEE",
        category: "card-payout",
        amount: 9263,
        feeAmount: 737,
      });
      await createTestBankTransaction({
        archivingCode: "D-NOFEE",
        category: "donation",
        amount: 1000,
        feeAmount: null,
      });

      const rows = await bankTransactionsRepository.cardPayoutsMissingFee();
      expect(rows.map((r) => r.archivingCode)).toEqual(["CP-NOFEE"]);
    });

    it("recordPayoutTotals writes gross and fee", async () => {
      await createTestBankTransaction({
        archivingCode: "CP1",
        category: "card-payout",
        amount: 67310,
        feeAmount: null,
      });
      const ok = await bankTransactionsRepository.recordPayoutTotals(
        "CP1",
        69000,
        1690,
      );
      expect(ok).toBe(true);

      const [row] = (
        await bankTransactionsRepository.findPaginated({
          page: 1,
          pageSize: 25,
        })
      ).data;
      expect(row.grossAmount).toBe(69000);
      expect(row.feeAmount).toBe(1690);

      expect(
        await bankTransactionsRepository.recordPayoutTotals("nope", 1, 1),
      ).toBe(false);
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

    it("transferPaidOut / transferGap / notYetTransferred", async () => {
      // a reconciled donation, allocated, assigned to a round, and paid out
      await createTestBankTransaction({
        archivingCode: "IN1",
        category: "donation",
        amount: 10000,
      });
      const transfer = await createTestDonationTransfer({
        datetime: "2026-01-18",
      });
      const paid = await createTestDonation({
        finalized: true,
        amount: 10000,
        donationTransferId: transfer.id,
      });
      await donationsRepository.setTransactionId(paid.id, "IN1", "manual");
      await createTestOrganizationDonation({
        donationId: paid.id,
        organizationInternalId: "AMF",
        amount: 10000,
      });
      await createTestBankTransaction({
        archivingCode: "OUT_A",
        category: "outgoing",
        amount: 7500, // €25 short of €100 owed — outside the €10/0.5% tolerance
        donationTransferId: transfer.id,
      });

      // a second round that is OVERpaid by the same amount — must NOT cancel
      const transfer2 = await createTestDonationTransfer({
        datetime: "2026-02-18",
      });
      const paid2 = await createTestDonation({
        finalized: true,
        amount: 10000,
        donationTransferId: transfer2.id,
      });
      await createTestOrganizationDonation({
        donationId: paid2.id,
        organizationInternalId: "AMF",
        amount: 10000,
      });
      await createTestBankTransaction({
        archivingCode: "OUT_B",
        category: "outgoing",
        amount: 12500, // €25 over
        donationTransferId: transfer2.id,
      });

      // a reconciled+allocated donation NOT yet in any round
      await createTestBankTransaction({
        archivingCode: "IN2",
        category: "donation",
        amount: 4000,
      });
      const backlog = await createTestDonation({
        finalized: true,
        amount: 4000,
      });
      await donationsRepository.setTransactionId(backlog.id, "IN2", "manual");
      await createTestOrganizationDonation({
        donationId: backlog.id,
        organizationInternalId: "AMF",
        amount: 4000,
      });

      const mf = await bankTransactionsRepository.moneyFlow({});
      expect(mf.transferPaidOut).toBe(20000);
      // 2500 (under) + 2500 (over) — absolute, not cancelling
      expect(mf.transferGap).toBe(5000);
      expect(mf.notYetTransferred).toBe(4000);
    });

    it("transferGap ignores rounds within tolerance", async () => {
      const transfer = await createTestDonationTransfer({
        datetime: "2026-01-18",
      });
      const d = await createTestDonation({
        finalized: true,
        amount: 10000,
        donationTransferId: transfer.id,
      });
      await createTestOrganizationDonation({
        donationId: d.id,
        organizationInternalId: "AMF",
        amount: 10000,
      });
      await createTestBankTransaction({
        archivingCode: "OUT_C",
        category: "outgoing",
        amount: 9950, // €0.50 short — within the €10 floor
        donationTransferId: transfer.id,
      });

      const mf = await bankTransactionsRepository.moneyFlow({});
      expect(mf.transferGap).toBe(0);
    });
  });

  describe("transfer link", () => {
    it("setDonationTransfer links outgoing rows and rejects non-outgoing / unknown codes", async () => {
      const transfer = await createTestDonationTransfer({
        datetime: "2026-01-18",
      });
      await createTestBankTransaction({
        archivingCode: "O1",
        category: "outgoing",
        amount: 500,
      });
      await createTestBankTransaction({
        archivingCode: "O2",
        category: "outgoing",
        amount: 700,
      });
      await createTestBankTransaction({
        archivingCode: "D1",
        category: "donation",
        amount: 900,
      });

      expect(
        await bankTransactionsRepository.setDonationTransfer(
          ["O1", "O2"],
          transfer.id,
        ),
      ).toEqual({ ok: true });

      // non-outgoing is rejected, nothing written
      expect(
        await bankTransactionsRepository.setDonationTransfer(
          ["D1"],
          transfer.id,
        ),
      ).toEqual({ ok: false, reason: "not-outgoing" });

      // unknown code
      expect(
        await bankTransactionsRepository.setDonationTransfer(
          ["NOPE"],
          transfer.id,
        ),
      ).toEqual({ ok: false, reason: "not-found" });

      // can't steal a payment already linked to another round
      const other = await createTestDonationTransfer({
        datetime: "2026-02-01",
      });
      expect(
        await bankTransactionsRepository.setDonationTransfer(["O2"], other.id),
      ).toEqual({ ok: false, reason: "already-linked" });
      // re-linking to the same round it's on is fine
      expect(
        await bankTransactionsRepository.setDonationTransfer(
          ["O2"],
          transfer.id,
        ),
      ).toEqual({ ok: true });

      // unlink
      expect(
        await bankTransactionsRepository.setDonationTransfer(["O1"], null),
      ).toEqual({ ok: true });

      const unlinked = await bankTransactionsRepository.findUnlinkedOutgoing(
        {},
      );
      expect(unlinked.map((r) => r.archivingCode).sort()).toEqual(["O1"]);
    });

    it("findUnlinkedOutgoing filters by date and search", async () => {
      await createTestBankTransaction({
        archivingCode: "OX",
        category: "outgoing",
        amount: 100,
        date: "2026-02-15",
        counterpartyName: "Recipient Org",
      });
      await createTestBankTransaction({
        archivingCode: "OY",
        category: "outgoing",
        amount: 200,
        date: "2026-05-01",
        counterpartyName: "Some Vendor",
      });

      const byDate = await bankTransactionsRepository.findUnlinkedOutgoing({
        dateFrom: "2026-02-01",
        dateTo: "2026-02-28",
      });
      expect(byDate.map((r) => r.archivingCode)).toEqual(["OX"]);

      const bySearch = await bankTransactionsRepository.findUnlinkedOutgoing({
        search: "recipient",
      });
      expect(bySearch.map((r) => r.archivingCode)).toEqual(["OX"]);
    });
  });
});
