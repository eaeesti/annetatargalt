import { describe, it, expect } from "vitest";
import { donationDraftJson, parseDonationDraft } from "../donation-draft";
import type { DonationState } from "../donation-draft";
import Proportions from "../proportions";

const causes = [
  {
    id: 1,
    organizations: [
      { internalId: "fund-a", fund: true },
      { internalId: "org-b", fund: false },
    ],
  },
  { id: 2, organizations: [{ internalId: "org-c", fund: false }] },
];

const banks = ["Bank A", "Bank B", null];

function current(data = causes) {
  return { proportions: Proportions.fromStrapiData(data), banks };
}

function donation(changes: Partial<DonationState> = {}): DonationState {
  return {
    amount: 30,
    type: "onetime",
    firstName: "Mari",
    lastName: "Maasikas",
    email: "mari@example.com",
    idCode: "49001010000",
    bank: "Bank B",
    companyDonation: false,
    companyName: "",
    companyCode: "",
    dedicateDonation: true,
    dedicationName: "Jaan",
    dedicationEmail: "jaan@example.com",
    dedicationMessage: "Palju õnne!",
    proportions: Proportions.fromStrapiData(causes),
    addTip: true,
    paymentMethod: "cardPayments",
    acceptTerms: true,
    ...changes,
  };
}

/** A kept draft with one of its form fields replaced. */
function withField(field: string, value: unknown): string {
  const draft = JSON.parse(donationDraftJson("null/null", 1, donation()));
  draft.donation[field] = value;
  return JSON.stringify(draft);
}

describe("donation drafts", () => {
  it("gives back the form as it was kept, terms not agreed to", () => {
    const json = donationDraftJson("null/null", 3, donation());
    expect(parseDonationDraft(json, "null/null", current())).toEqual({
      stage: 3,
      donation: donation({ acceptTerms: false }),
    });
  });

  it("doesn't keep agreeing to the terms", () => {
    const json = donationDraftJson("null/null", 3, donation());
    expect(json).not.toContain("acceptTerms");
  });

  it("keeps the split with its locks and expert choices", () => {
    const proportions = Proportions.fromStrapiData(causes)
      .toggleToFund(1)
      .updateSubProportion(1, "org-b", 70)
      .updateProportion(2, 20)
      .toggleProportionLock(2);
    const json = donationDraftJson("null/null", 0, donation({ proportions }));

    const draft = parseDonationDraft(json, "null/null", current());
    expect(draft?.donation.proportions).toEqual(proportions);
    expect(draft?.donation.proportions.getProportion(2)).toBe(20);
    expect(draft?.donation.proportions.isLocked(2)).toBe(true);
    expect(draft?.donation.proportions.goesToFund(1)).toBe(false);
    expect(draft?.donation.proportions.getSubProportion(1, "org-b")).toBe(70);
  });

  it("is only for the link it was kept for", () => {
    const json = donationDraftJson("onetime/org-c", 1, donation());
    expect(parseDonationDraft(json, "onetime/org-c", current())).not.toBeNull();
    expect(parseDonationDraft(json, "null/null", current())).toBeNull();
    expect(parseDonationDraft(json, "onetime/null", current())).toBeNull();
  });

  it("starts at the split, with the current one, when organizations changed", () => {
    const json = donationDraftJson("null/null", 3, donation());
    const changed = [
      causes[0],
      {
        id: 2,
        organizations: [
          { internalId: "org-c", fund: false },
          { internalId: "org-d", fund: false },
        ],
      },
    ];

    const draft = parseDonationDraft(json, "null/null", current(changed));
    expect(draft?.stage).toBe(0);
    expect(draft?.donation.proportions).toEqual(
      Proportions.fromStrapiData(changed),
    );
    expect(draft?.donation.email).toBe("mari@example.com");
  });

  it("starts at the split when a cause is gone", () => {
    const json = donationDraftJson("null/null", 2, donation());
    const draft = parseDonationDraft(json, "null/null", current([causes[0]]));
    expect(draft?.stage).toBe(0);
  });

  it("forgets a bank no longer listed, but not 'other'", () => {
    const gone = donationDraftJson("null/null", 3, donation({ bank: "Old" }));
    expect(
      parseDonationDraft(gone, "null/null", current())?.donation.bank,
    ).toBe("");

    const other = donationDraftJson(
      "null/null",
      3,
      donation({ bank: "other" }),
    );
    expect(
      parseDonationDraft(other, "null/null", current())?.donation.bank,
    ).toBe("other");
  });

  it("is null when nothing was kept or it isn't JSON", () => {
    expect(parseDonationDraft(null, "null/null", current())).toBeNull();
    expect(parseDonationDraft("{", "null/null", current())).toBeNull();
    expect(parseDonationDraft("[]", "null/null", current())).toBeNull();
  });

  it("is null when a field is missing or the wrong kind", () => {
    expect(
      parseDonationDraft(withField("email", undefined), "null/null", current()),
    ).toBeNull();
    expect(
      parseDonationDraft(withField("amount", "30"), "null/null", current()),
    ).toBeNull();
    expect(
      parseDonationDraft(withField("amount", 0), "null/null", current()),
    ).toBeNull();
    expect(
      parseDonationDraft(withField("type", "weekly"), "null/null", current()),
    ).toBeNull();
    expect(
      parseDonationDraft(withField("addTip", "yes"), "null/null", current()),
    ).toBeNull();
    expect(
      parseDonationDraft(
        withField("paymentMethod", "cash"),
        "null/null",
        current(),
      ),
    ).toBeNull();
  });

  it("is null when the step isn't one of the form's", () => {
    for (const stage of [-1, 4, 1.5, "1"]) {
      const draft = JSON.parse(donationDraftJson("null/null", 1, donation()));
      draft.stage = stage;
      expect(
        parseDonationDraft(JSON.stringify(draft), "null/null", current()),
      ).toBeNull();
    }
  });
});
