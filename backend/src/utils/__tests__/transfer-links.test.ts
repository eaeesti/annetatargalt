import { describe, it, expect } from "vitest";
import {
  assignToRound,
  isRecipientCounterparty,
  type RoundRef,
} from "../transfer-links";

describe("isRecipientCounterparty", () => {
  it("matches the allowlisted recipients, case-insensitively", () => {
    expect(isRecipientCounterparty("Giving What We Can UK")).toBe(true);
    expect(isRecipientCounterparty("EFFECTIVE VENTURES FOUNDATION (UK)")).toBe(
      true,
    );
    expect(isRecipientCounterparty("Centre for Effective Altruism")).toBe(true);
    expect(
      isRecipientCounterparty("Mittetulundusühing Efektiivne Altruism Eesti"),
    ).toBe(true);
  });

  it("rejects operational-spend counterparties and blanks", () => {
    expect(isRecipientCounterparty("Maksu- ja Tolliamet")).toBe(false);
    expect(isRecipientCounterparty("Rahva Raamat AS")).toBe(false);
    expect(isRecipientCounterparty(null)).toBe(false);
    expect(isRecipientCounterparty("")).toBe(false);
  });

  it("honours a custom allowlist", () => {
    expect(isRecipientCounterparty("StrongMinds", ["strongminds"])).toBe(true);
    expect(isRecipientCounterparty("Giving What We Can", ["strongminds"])).toBe(
      false,
    );
  });
});

describe("assignToRound", () => {
  const rounds: RoundRef[] = [
    { id: 10, datetime: "2025-11-01" },
    { id: 11, datetime: "2026-01-18" },
    { id: 12, datetime: "2026-04-18" },
  ];

  it("assigns a payment to the most recent round on or before its date", () => {
    expect(assignToRound("2026-02-15", rounds)).toBe(11);
    expect(assignToRound("2026-01-18", rounds)).toBe(11); // same day counts
    expect(assignToRound("2026-05-12", rounds)).toBe(12);
  });

  it("returns null when the payment predates every round", () => {
    expect(assignToRound("2025-01-01", rounds)).toBeNull();
  });

  it("returns null when the payment trails its round by more than the lookback", () => {
    // 2026-09-01 is >120 days after round 12 (2026-04-18)
    expect(assignToRound("2026-09-01", rounds)).toBeNull();
    expect(assignToRound("2026-09-01", rounds, 200)).toBe(12);
  });

  it("handles ISO timestamps (uses the date part only)", () => {
    expect(assignToRound("2026-02-15T09:30:00.000Z", rounds)).toBe(11);
  });
});
