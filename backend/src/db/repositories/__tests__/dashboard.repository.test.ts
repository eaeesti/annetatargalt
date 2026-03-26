/**
 * Integration tests for DashboardRepository
 *
 * Verifies all stats queries used on the dashboard page.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DashboardRepository } from "../dashboard.repository";
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
