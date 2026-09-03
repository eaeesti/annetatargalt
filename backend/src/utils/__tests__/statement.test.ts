import { describe, it, expect } from "vitest";
import {
  categorizeStatement,
  selectTemplate,
  planRecurringImport,
  looksLikeCardPayout,
  parsePayoutUuidPrefix,
  splitFeeProRata,
  type RecurringTemplate,
  type DonorTemplates,
  type StatementInput,
} from "../statement";
import type { BankTransaction, ReconcilableDonation } from "../reconciliation";

function txn(o: Partial<BankTransaction>): BankTransaction {
  return {
    date: "2026-06-15",
    amountCents: 3000,
    archivingCode: "2026061500000001",
    description: "Anneta Targalt püsiannetus",
    idOrRegCode: "39001010001",
    counterpartyAccount: "EE001",
    counterpartyName: "Test Testija",
    direction: "C",
    ...o,
  };
}

function template(o: Partial<RecurringTemplate>): RecurringTemplate {
  return {
    id: 1,
    donorId: 10,
    datetime: "2026-01-01T00:00:00.000Z",
    amount: 3000,
    companyName: null,
    companyCode: null,
    bank: "swedbank",
    orgSplit: [
      { organizationInternalId: "ORG-A", amount: 2000 },
      { organizationInternalId: "ORG-B", amount: 1000 },
    ],
    ...o,
  };
}

function baseInput(o: Partial<StatementInput>): StatementInput {
  return {
    transactions: [],
    unreconciledDonations: [],
    reconciledCodes: new Set(),
    ignoredCodes: new Set(),
    donorsByCode: new Map(),
    ...o,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

describe("looksLikeCardPayout", () => {
  it("recognises Montonio payouts and the STRIPE/MONTONIO label", () => {
    expect(
      looksLikeCardPayout(
        txn({
          counterpartyName: "Montonio Finance UAB",
          description: "Card payout abc",
        }),
      ),
    ).toBe(true);
    expect(
      looksLikeCardPayout(
        txn({ counterpartyName: "STRIPE", description: "MONTONIO FINANCE" }),
      ),
    ).toBe(true);
  });

  it("leaves a normal donor transfer alone", () => {
    expect(
      looksLikeCardPayout(
        txn({
          counterpartyName: "Jaan Tamm",
          description: "Anneta Targalt annetus 5",
        }),
      ),
    ).toBe(false);
  });
});

describe("parsePayoutUuidPrefix", () => {
  it("pulls the (possibly truncated) uuid out of the Selgitus", () => {
    expect(
      parsePayoutUuidPrefix("Card payout faab4de5-117b-493d-b4d2-63b0f38bb"),
    ).toBe("faab4de5-117b-493d-b4d2-63b0f38bb");
    expect(parsePayoutUuidPrefix("Anneta Targalt annetus 5")).toBeNull();
  });
});

// ─── selectTemplate ──────────────────────────────────────────────────────────

describe("selectTemplate", () => {
  const newest = template({ id: 3, datetime: "2026-05-01T00:00:00Z" });
  const middle = template({ id: 2, datetime: "2026-03-01T00:00:00Z" });
  const oldest = template({ id: 1, datetime: "2026-01-01T00:00:00Z" });
  const templates = [newest, middle, oldest]; // newest first, as the repo returns

  it("picks the newest template that predates the payment", () => {
    expect(selectTemplate(templates, "2026-04-10")?.id).toBe(2);
    expect(selectTemplate(templates, "2026-06-10")?.id).toBe(3);
  });

  it("allows a 24h grace (template created later the same day), not well after", () => {
    expect(
      selectTemplate(
        [template({ id: 9, datetime: "2026-06-10T18:00:00Z" })],
        "2026-06-10",
      )?.id,
    ).toBe(9);
    expect(
      selectTemplate(
        [template({ id: 9, datetime: "2026-06-11T09:00:00Z" })],
        "2026-06-10",
      ),
    ).toBeNull();
  });

  it("returns null when every template is newer than the payment", () => {
    expect(selectTemplate(templates, "2025-12-01")).toBeNull();
  });
});

// ─── planRecurringImport ─────────────────────────────────────────────────────

describe("planRecurringImport", () => {
  it("copies the template split when the amount matches", () => {
    const plan = planRecurringImport(txn({ amountCents: 3000 }), template({}));
    expect(plan.amountDrifted).toBe(false);
    expect(plan.orgDonations).toEqual([
      { organizationInternalId: "ORG-A", amountCents: 2000 },
      { organizationInternalId: "ORG-B", amountCents: 1000 },
    ]);
    expect(plan.paymentMethod).toBe("swedbank");
    expect(plan.iban).toBe("EE001");
    expect(plan.archivingCode).toBe("2026061500000001");
  });

  it("scales the split proportionally on amount drift, and still sums exactly", () => {
    const plan = planRecurringImport(
      txn({ amountCents: 1000 }),
      template({ amount: 3000 }),
    );
    expect(plan.amountDrifted).toBe(true);
    const total = plan.orgDonations.reduce((s, o) => s + o.amountCents, 0);
    expect(total).toBe(1000);
  });

  it("handles a rounding remainder without losing cents", () => {
    const plan = planRecurringImport(
      txn({ amountCents: 1000 }),
      template({
        amount: 3000,
        orgSplit: [
          { organizationInternalId: "A", amount: 1000 },
          { organizationInternalId: "B", amount: 1000 },
          { organizationInternalId: "C", amount: 1000 },
        ],
      }),
    );
    expect(plan.orgDonations.reduce((s, o) => s + o.amountCents, 0)).toBe(1000);
  });

  it("throws on a template with no org split (rather than crashing on resize)", () => {
    expect(() =>
      planRecurringImport(txn({}), template({ orgSplit: [] })),
    ).toThrow(/no organization split/);
  });
});

// ─── categorizeStatement ─────────────────────────────────────────────────────

function donation(o: Partial<ReconcilableDonation>): ReconcilableDonation {
  return {
    id: 1,
    amountCents: 3000,
    datetime: "2026-06-14T10:00:00Z",
    companyCode: null,
    donorIdCode: "39001010001",
    ...o,
  };
}

describe("categorizeStatement", () => {
  it("counts already-reconciled and ignored codes, acts on neither", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [
          txn({ archivingCode: "DONE" }),
          txn({ archivingCode: "IGNORED" }),
        ],
        reconciledCodes: new Set(["DONE"]),
        ignoredCodes: new Set(["IGNORED"]),
      }),
    );
    expect(report.counts).toMatchObject({ alreadyReconciled: 1, ignored: 1 });
    expect(report.recurringImports).toHaveLength(0);
    expect(report.notADonation).toHaveLength(0);
  });

  it("never re-reconciles a code that is already on a donation or ignored, even if matchDonations finds a same-amount donation in the window", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [
          txn({ archivingCode: "DONE", amountCents: 3000, date: "2026-06-15" }),
          txn({
            archivingCode: "IGN",
            amountCents: 3000,
            date: "2026-06-15",
            idOrRegCode: "38000000000",
          }),
        ],
        unreconciledDonations: [
          donation({ id: 7, amountCents: 3000, donorIdCode: "39001010001" }),
          donation({ id: 8, amountCents: 3000, donorIdCode: "38000000000" }),
        ],
        reconciledCodes: new Set(["DONE"]),
        ignoredCodes: new Set(["IGN"]),
      }),
    );
    expect(report.reconcile).toHaveLength(0);
    expect(report.counts).toMatchObject({ alreadyReconciled: 1, ignored: 1 });
  });

  it("a code matching >1 existing donation goes to needs-a-decision, not auto-reconcile", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [
          txn({ archivingCode: "DUP", amountCents: 3000, date: "2026-06-15" }),
        ],
        unreconciledDonations: [
          donation({ id: 7, amountCents: 3000 }),
          donation({ id: 8, amountCents: 3000 }),
        ],
      }),
    );
    expect(report.reconcile).toHaveLength(0);
    expect(report.needsDecision).toHaveLength(1);
    expect(report.needsDecision[0].reason).toMatch(/matches 2 existing/);
  });

  it("recurring template with no org split → needs a decision, not a crash", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [txn({ archivingCode: "NOSPLIT", amountCents: 3000 })],
        donorsByCode: new Map<string, DonorTemplates>([
          [
            "39001010001",
            { donorId: 10, templates: [template({ orgSplit: [] })] },
          ],
        ]),
      }),
    );
    expect(report.recurringImports).toHaveLength(0);
    expect(report.needsDecision[0].reason).toMatch(/no organization split/);
  });

  it("assigns a code to an existing unreconciled donation (step 2 wins over import)", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [
          txn({ archivingCode: "X", amountCents: 3000, date: "2026-06-15" }),
        ],
        unreconciledDonations: [donation({ id: 7, amountCents: 3000 })],
        donorsByCode: new Map([
          ["39001010001", { donorId: 10, templates: [template({})] }],
        ]),
      }),
    );
    expect(report.reconcile).toEqual([
      { donationId: 7, archivingCode: "X", source: "idcode-amount-date" },
    ]);
    expect(report.recurringImports).toHaveLength(0);
  });

  it("plans a recurring import when no donation exists yet", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [txn({ archivingCode: "NEW", amountCents: 3000 })],
        donorsByCode: new Map<string, DonorTemplates>([
          ["39001010001", { donorId: 10, templates: [template({})] }],
        ]),
      }),
    );
    expect(report.recurringImports).toHaveLength(1);
    expect(report.recurringImports[0]).toMatchObject({
      archivingCode: "NEW",
      donorId: 10,
      templateId: 1,
      amountCents: 3000,
    });
  });

  it("routes card payouts to their own bucket", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [
          txn({
            archivingCode: "P",
            counterpartyName: "Montonio Finance UAB",
            description: "Card payout abc123",
            amountCents: 29263,
          }),
        ],
      }),
    );
    expect(report.cardPayouts).toHaveLength(1);
    expect(report.recurringImports).toHaveLength(0);
  });

  it("known donor with no template → needs a decision, not an import", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [txn({ archivingCode: "Q" })],
        donorsByCode: new Map([
          ["39001010001", { donorId: 10, templates: [] }],
        ]),
      }),
    );
    expect(report.recurringImports).toHaveLength(0);
    expect(report.needsDecision).toHaveLength(1);
    expect(report.needsDecision[0].reason).toMatch(/no recurring template/);
  });

  it("donation-like Selgitus from an unknown sender → needs a decision", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [
          txn({
            archivingCode: "R",
            idOrRegCode: "99999999999",
            description: "Anneta Targalt annetus",
          }),
        ],
      }),
    );
    expect(report.needsDecision).toHaveLength(1);
    expect(report.notADonation).toHaveLength(0);
  });

  it("everything else → not a donation", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [
          txn({
            archivingCode: "S",
            idOrRegCode: "",
            counterpartyName: "Some Foundation",
            description: "Saadud intress",
          }),
        ],
      }),
    );
    expect(report.notADonation).toHaveLength(1);
  });

  it("ignores debit rows and rows with no archiving code", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [
          txn({ direction: "D", archivingCode: "D1" }),
          txn({ archivingCode: "" }),
        ],
      }),
    );
    expect(report.counts.creditTransactions).toBe(0);
  });

  it("returns every credit line in allCredits (deduped) and counts the unrecorded ones", () => {
    const report = categorizeStatement(
      baseInput({
        transactions: [
          txn({ archivingCode: "A" }),
          txn({ archivingCode: "A" }), // dupe
          txn({ archivingCode: "B" }),
          txn({ direction: "D", archivingCode: "C" }), // debit, excluded
        ],
        recordedCodes: new Set(["A"]),
      }),
    );
    expect(report.allCredits.map((t) => t.archivingCode).sort()).toEqual([
      "A",
      "B",
    ]);
    expect(report.counts.unrecorded).toBe(1); // only B is new
  });
});

describe("splitFeeProRata", () => {
  it("splits pro-rata and sums to exactly the fee", () => {
    const shares = splitFeeProRata(1000, [
      { id: 1, grossCents: 3000 },
      { id: 2, grossCents: 6000 },
      { id: 3, grossCents: 1000 },
    ]);
    expect(shares[1] + shares[2] + shares[3]).toBe(1000);
    expect(shares[2]).toBeGreaterThan(shares[1]);
  });

  it("puts the rounding remainder on the largest donation", () => {
    const shares = splitFeeProRata(100, [
      { id: 1, grossCents: 1 },
      { id: 2, grossCents: 1 },
      { id: 3, grossCents: 1 },
    ]);
    expect(shares[1] + shares[2] + shares[3]).toBe(100);
  });

  it("handles a single donation", () => {
    expect(splitFeeProRata(737, [{ id: 9, grossCents: 10000 }])).toEqual({
      9: 737,
    });
  });

  it("handles a zero fee", () => {
    expect(
      splitFeeProRata(0, [
        { id: 1, grossCents: 100 },
        { id: 2, grossCents: 200 },
      ]),
    ).toEqual({ 1: 0, 2: 0 });
  });

  it("returns {} for no donations", () => {
    expect(splitFeeProRata(500, [])).toEqual({});
  });
});
