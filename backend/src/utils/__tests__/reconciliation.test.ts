import { describe, it, expect } from "vitest";
import {
  parseLhvCsv,
  parseAmountToCents,
  parseSelgitusDonationId,
  matchDonations,
  type BankTransaction,
  type ReconcilableDonation,
} from "../reconciliation";

// ─── Fixtures (synthetic — no real donor data) ───────────────────────────────

const ESTONIAN_CSV = `﻿"Kliendi konto","Kuupäev","Saaja/maksja konto","Saaja/maksja nimi","Deebet/Kreedit (D/C)","Summa","Arhiveerimistunnus","Selgitus","Valuuta","Isikukood või registrikood"
"EE24","2024-03-01","EE99","AAA BBB","C",15.00,"2024030100000001","Anneta Targalt annetus 101","EUR","39000000000"
"EE24","2024-03-01","EE88","CCC DDD","C",30.00,"2024030100000002","Anneta Targalt annetus","EUR","38000000000"
"EE24","2024-03-02","EE24","Card payment","D",4.20,"2024030200000003","RIMI","EUR",""
`;

const ENGLISH_CSV = `﻿"Customer account no","Date","Sender/receiver account","Sender/receiver name","Debit/Credit (D/C)","Amount","Archiving code","Description","Currency","Personal code or register code"
"EE24","2024-03-01","EE99","AAA BBB","C",15.00,"2024030100000001","Anneta Targalt annetus 101","EUR","39000000000"
`;

function txn(overrides: Partial<BankTransaction>): BankTransaction {
  return {
    date: "2024-03-01",
    amountCents: 3000,
    archivingCode: "2024030100000000",
    description: "",
    idOrRegCode: "",
    counterpartyAccount: "EE99",
    counterpartyName: "Test Testija",
    direction: "C",
    ...overrides,
  };
}

function donation(
  overrides: Partial<ReconcilableDonation>,
): ReconcilableDonation {
  return {
    id: 1,
    amountCents: 3000,
    datetime: "2024-03-01T10:00:00.000Z",
    companyCode: null,
    donorIdCode: "39000000000",
    ...overrides,
  };
}

// ─── parseAmountToCents ──────────────────────────────────────────────────────

describe("parseAmountToCents", () => {
  it("parses dot-decimal", () => {
    expect(parseAmountToCents("15.00")).toBe(1500);
    expect(parseAmountToCents("1234.56")).toBe(123456);
  });

  it("parses comma-decimal and space thousands", () => {
    expect(parseAmountToCents("15,00")).toBe(1500);
    expect(parseAmountToCents("1 234,56")).toBe(123456);
  });

  it("throws on garbage", () => {
    expect(() => parseAmountToCents("abc")).toThrow();
  });
});

// ─── parseSelgitusDonationId ─────────────────────────────────────────────────

describe("parseSelgitusDonationId", () => {
  it("extracts the id", () => {
    expect(parseSelgitusDonationId("Anneta Targalt annetus 1337")).toBe(1337);
  });

  it("returns null when absent", () => {
    expect(parseSelgitusDonationId("Anneta Targalt annetus")).toBeNull();
    expect(parseSelgitusDonationId("Kuupalgatus")).toBeNull();
  });
});

// ─── parseLhvCsv ─────────────────────────────────────────────────────────────

describe("parseLhvCsv", () => {
  it("parses the Estonian export incl. BOM, keeps debits", () => {
    const rows = parseLhvCsv(ESTONIAN_CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      date: "2024-03-01",
      amountCents: 1500,
      archivingCode: "2024030100000001",
      description: "Anneta Targalt annetus 101",
      idOrRegCode: "39000000000",
      direction: "C",
    });
    expect(rows[2].direction).toBe("D");
  });

  it("parses the English export identically", () => {
    const [et] = parseLhvCsv(ESTONIAN_CSV);
    const [en] = parseLhvCsv(ENGLISH_CSV);
    expect(en).toEqual(et);
  });

  it("rejects a CSV that is not an LHV statement", () => {
    expect(() => parseLhvCsv("foo,bar\n1,2\n")).toThrow(
      /LHV account statement/,
    );
  });

  it("handles CRLF, and mixed line endings without a trailing newline", () => {
    const crlf = ESTONIAN_CSV.replace(/\n/g, "\r\n");
    expect(parseLhvCsv(crlf)).toHaveLength(3);

    // header + first row CRLF, rest LF, no trailing newline (a hand-edited file)
    const lines = ESTONIAN_CSV.trimEnd().split("\n");
    const mixed = `${lines[0]}\r\n${lines.slice(1).join("\n")}`;
    expect(parseLhvCsv(mixed)).toHaveLength(3);
  });
});

// ─── matchDonations ──────────────────────────────────────────────────────────

describe("matchDonations", () => {
  it("matches via Selgitus donation id + amount", () => {
    const transactions = [
      txn({
        archivingCode: "SELG",
        description: "Anneta Targalt annetus 1",
        amountCents: 3000,
      }),
    ];
    const report = matchDonations(transactions, [donation({ id: 1 })]);
    expect(report.matched).toEqual([
      { donationId: 1, archivingCode: "SELG", source: "selgitus-id" },
    ]);
    expect(report.donationlessTransactions).toHaveLength(0);
  });

  it("Selgitus needs the amount to agree", () => {
    const transactions = [
      txn({ description: "Anneta Targalt annetus 1", amountCents: 9999 }),
    ];
    const report = matchDonations(transactions, [donation({ id: 1 })]);
    expect(report.matched).toHaveLength(0);
    expect(report.transactionlessDonations).toEqual([1]);
  });

  it("Selgitus beats id-code + date", () => {
    const transactions = [
      txn({ archivingCode: "IDCODE", idOrRegCode: "39000000000" }),
      txn({
        archivingCode: "SELG",
        description: "Anneta Targalt annetus 1",
        idOrRegCode: "",
      }),
    ];
    const report = matchDonations(transactions, [donation({ id: 1 })]);
    expect(report.matched[0]).toMatchObject({
      archivingCode: "SELG",
      source: "selgitus-id",
    });
  });

  it("matches via id code, amount, and date window", () => {
    const transactions = [
      txn({
        archivingCode: "IDCODE",
        idOrRegCode: "39000000000",
        date: "2024-03-03",
      }),
    ];
    const report = matchDonations(transactions, [
      donation({ id: 1, datetime: "2024-03-01T10:00:00Z" }),
    ]);
    expect(report.matched[0]).toMatchObject({
      archivingCode: "IDCODE",
      source: "idcode-amount-date",
    });
  });

  it("matches company code too", () => {
    const transactions = [
      txn({ archivingCode: "CO", idOrRegCode: "12345678" }),
    ];
    const report = matchDonations(transactions, [
      donation({ id: 1, donorIdCode: null, companyCode: "12345678" }),
    ]);
    expect(report.matched[0]).toMatchObject({ archivingCode: "CO" });
  });

  it("honours the date window boundaries (0..4 days, no negatives)", () => {
    const d = donation({ id: 1, datetime: "2024-03-10T10:00:00Z" });
    const at = (date: string) =>
      matchDonations([txn({ idOrRegCode: "39000000000", date })], [d]).matched
        .length;
    expect(at("2024-03-10")).toBe(1); // same day
    expect(at("2024-03-14")).toBe(1); // +4
    expect(at("2024-03-15")).toBe(0); // +5
    expect(at("2024-03-09")).toBe(0); // -1
  });

  it("flags ambiguity when >1 candidate transaction", () => {
    const transactions = [
      txn({ archivingCode: "A", idOrRegCode: "39000000000" }),
      txn({ archivingCode: "B", idOrRegCode: "39000000000" }),
    ];
    const report = matchDonations(transactions, [donation({ id: 1 })]);
    expect(report.matched).toHaveLength(0);
    expect(report.ambiguous).toEqual([
      { donationId: 1, candidateCodes: ["A", "B"] },
    ]);
  });

  it("overrides win over everything and are reported as manual", () => {
    const transactions = [
      txn({ archivingCode: "AUTO", description: "Anneta Targalt annetus 1" }),
    ];
    const report = matchDonations(
      transactions,
      [donation({ id: 1 })],
      new Map([[1, "MANUAL"]]),
    );
    expect(report.matched).toEqual([
      { donationId: 1, archivingCode: "MANUAL", source: "manual" },
    ]);
  });

  it("batch: several donations resolve to one archiving code (via overrides)", () => {
    const transactions = [txn({ archivingCode: "BATCH", amountCents: 9000 })];
    const donations = [
      donation({ id: 1, amountCents: 3000 }),
      donation({ id: 2, amountCents: 3000 }),
      donation({ id: 3, amountCents: 3000 }),
    ];
    const overrides = new Map([
      [1, "BATCH"],
      [2, "BATCH"],
      [3, "BATCH"],
    ]);
    const report = matchDonations(transactions, donations, overrides);
    expect(report.matched.map((m) => m.archivingCode)).toEqual([
      "BATCH",
      "BATCH",
      "BATCH",
    ]);
    expect(report.donationlessTransactions).toHaveLength(0);
  });

  it("ignores debit rows", () => {
    const transactions = [
      txn({
        archivingCode: "DEBIT",
        idOrRegCode: "39000000000",
        direction: "D",
      }),
    ];
    const report = matchDonations(transactions, [donation({ id: 1 })]);
    expect(report.matched).toHaveLength(0);
    expect(report.transactionlessDonations).toEqual([1]);
  });

  it("reports donationless transactions and transactionless donations", () => {
    const transactions = [
      txn({ archivingCode: "USED", description: "Anneta Targalt annetus 1" }),
      txn({ archivingCode: "ORPHAN", idOrRegCode: "00000000000" }),
    ];
    const donations = [
      donation({ id: 1 }),
      donation({ id: 2, donorIdCode: "11111111111" }),
    ];
    const report = matchDonations(transactions, donations);
    expect(report.matched).toHaveLength(1);
    expect(report.donationlessTransactions.map((t) => t.archivingCode)).toEqual(
      ["ORPHAN"],
    );
    expect(report.transactionlessDonations).toEqual([2]);
  });
});
