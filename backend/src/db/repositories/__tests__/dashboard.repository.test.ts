/**
 * Integration tests for DashboardRepository
 *
 * Verifies all stats queries used on the dashboard page.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DashboardRepository,
  monthRange,
  quarterRange,
  yearRange,
} from "../dashboard.repository";
import {
  cleanDatabase,
  createTestDonor,
  createTestDonation,
  createTestRecurringDonation,
} from "../../__tests__/test-db-helper";

// Use a fresh instance per test so constructor default db is used
const repo = new DashboardRepository();

describe("DashboardRepository", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // ── getTotalDonations ────────────────────────────────────────────────────────

  describe("getTotalDonations", () => {
    it("returns zero when no donations exist", async () => {
      const result = await repo.getTotalDonations();
      expect(result.count).toBe(0);
      expect(result.sum).toBe(0);
    });

    it("counts and sums only finalized donations", async () => {
      await createTestDonation({ finalized: true, amount: 1000 });
      await createTestDonation({ finalized: true, amount: 2500 });
      await createTestDonation({ finalized: false, amount: 9999 }); // excluded

      const result = await repo.getTotalDonations();
      expect(result.count).toBe(2);
      expect(result.sum).toBe(3500);
    });
  });

  // ── getTotalDonors ───────────────────────────────────────────────────────────

  describe("getTotalDonors", () => {
    it("returns zero when no finalized donations exist", async () => {
      const result = await repo.getTotalDonors();
      expect(result).toBe(0);
    });

    it("counts distinct donors from finalized donations only", async () => {
      const d1 = await createTestDonor({ email: "a@test.com" });
      const d2 = await createTestDonor({ email: "b@test.com" });

      // d1 has two finalized donations — should count as 1
      await createTestDonation({
        donorId: d1.id,
        finalized: true,
        amount: 100,
      });
      await createTestDonation({
        donorId: d1.id,
        finalized: true,
        amount: 200,
      });
      // d2 has one finalized donation
      await createTestDonation({
        donorId: d2.id,
        finalized: true,
        amount: 300,
      });
      // unfinalized donation — d2 still counts, but unfinalized-only donors don't
      const d3 = await createTestDonor({ email: "c@test.com" });
      await createTestDonation({
        donorId: d3.id,
        finalized: false,
        amount: 400,
      });

      const result = await repo.getTotalDonors();
      expect(result).toBe(2); // d1 and d2 only
    });

    it("excludes donations with null donorId", async () => {
      await createTestDonation({ donorId: null, finalized: true, amount: 500 });
      const result = await repo.getTotalDonors();
      expect(result).toBe(0);
    });
  });

  // ── getActiveDonors ──────────────────────────────────────────────────────────

  describe("getActiveDonors", () => {
    it("counts donors who donated within the last 12 months", async () => {
      const active = await createTestDonor({ email: "active@test.com" });
      const old = await createTestDonor({ email: "old@test.com" });

      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 6); // 6 months ago

      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago

      await createTestDonation({
        donorId: active.id,
        finalized: true,
        datetime: recentDate,
        amount: 100,
      });
      await createTestDonation({
        donorId: old.id,
        finalized: true,
        datetime: oldDate,
        amount: 200,
      });

      const result = await repo.getActiveDonors();
      expect(result).toBe(1);
    });
  });

  // ── getMrr ───────────────────────────────────────────────────────────────────

  describe("getMrr", () => {
    it("returns zero when no active recurring donations exist", async () => {
      const result = await repo.getMrr();
      expect(result).toBe(0);
    });

    it("sums only active recurring donations", async () => {
      const donor = await createTestDonor();
      await createTestRecurringDonation({
        donorId: donor.id,
        amount: 500,
        active: true,
      });
      await createTestRecurringDonation({
        donorId: donor.id,
        amount: 1500,
        active: true,
      });
      await createTestRecurringDonation({
        donorId: donor.id,
        amount: 9999,
        active: false, // excluded
      });

      const result = await repo.getMrr();
      expect(result).toBe(2000);
    });
  });

  // ── getPeriodStats ───────────────────────────────────────────────────────────

  describe("getPeriodStats", () => {
    it("returns zero stats for an empty period", async () => {
      const from = new Date("2025-01-01");
      const to = new Date("2025-02-01");
      const result = await repo.getPeriodStats(from, to);
      expect(result.count).toBe(0);
      expect(result.total).toBe(0);
    });

    it("sums finalized donations within the period", async () => {
      await createTestDonation({
        finalized: true,
        amount: 1000,
        datetime: new Date("2025-01-15"),
      });
      await createTestDonation({
        finalized: true,
        amount: 2000,
        datetime: new Date("2025-01-20"),
      });
      // Outside range — before
      await createTestDonation({
        finalized: true,
        amount: 9999,
        datetime: new Date("2024-12-31"),
      });
      // Outside range — after (clearly after to)
      await createTestDonation({
        finalized: true,
        amount: 9999,
        datetime: new Date("2025-02-02"),
      });
      // Unfinalized — excluded
      await createTestDonation({
        finalized: false,
        amount: 9999,
        datetime: new Date("2025-01-10"),
      });

      const result = await repo.getPeriodStats(
        new Date("2025-01-01"),
        new Date("2025-02-01"),
      );
      expect(result.count).toBe(2);
      expect(result.total).toBe(3000);
    });
  });
});

// ── period range helpers (pure — no DB) ─────────────────────────────────────────

function iso(range: [Date, Date]): [string, string] {
  return [range[0].toISOString(), range[1].toISOString()];
}

describe("monthRange", () => {
  it("returns [start, end) of the current month", () => {
    expect(iso(monthRange(new Date("2026-03-17T09:00:00Z"), 0))).toEqual([
      "2026-03-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
    ]);
  });

  it("goes back N months, crossing a year boundary", () => {
    const now = new Date("2026-01-15T09:00:00Z");
    expect(iso(monthRange(now, 1))).toEqual([
      "2025-12-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
    expect(iso(monthRange(now, 2))).toEqual([
      "2025-11-01T00:00:00.000Z",
      "2025-12-01T00:00:00.000Z",
    ]);
  });
});

describe("quarterRange", () => {
  it("returns [start, end) of the current quarter", () => {
    // May → Q2
    expect(iso(quarterRange(new Date("2026-05-10T09:00:00Z"), 0))).toEqual([
      "2026-04-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
    ]);
  });

  it("goes back N quarters, crossing a year boundary", () => {
    const now = new Date("2026-05-10T09:00:00Z"); // Q2 2026
    expect(iso(quarterRange(now, 1))).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
    ]);
    expect(iso(quarterRange(now, 2))).toEqual([
      "2025-10-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
  });
});

describe("yearRange", () => {
  it("returns [start, end) of the current and prior years", () => {
    const now = new Date("2026-06-01T09:00:00Z");
    expect(iso(yearRange(now, 0))).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
    expect(iso(yearRange(now, 1))).toEqual([
      "2025-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
    expect(iso(yearRange(now, 2))).toEqual([
      "2024-01-01T00:00:00.000Z",
      "2025-01-01T00:00:00.000Z",
    ]);
  });
});
