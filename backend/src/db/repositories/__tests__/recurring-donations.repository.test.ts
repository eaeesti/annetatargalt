/**
 * Integration tests for RecurringDonationsRepository — status computation.
 *
 * "status" (findPaginated + findByIdWithFullDonations) is payment-based: a
 * finalized donation linked to the recurring donation within the current
 * RECURRING_ACTIVITY_WINDOW_DAYS window means "active"; one ever, but not
 * recently, means "stopped"; none ever means "neverStarted".
 */

import { describe, it, expect, beforeEach } from "vitest";
import { recurringDonationsRepository } from "../recurring-donations.repository";
import {
  cleanDatabase,
  createTestDonor,
  createTestDonation,
  createTestRecurringDonation,
} from "../../__tests__/test-db-helper";

describe("RecurringDonationsRepository", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // ── findPaginated: status ────────────────────────────────────────────────────

  describe("findPaginated status", () => {
    it("is 'neverStarted' when no donation has ever been linked", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });

      const { data } = await recurringDonationsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data.find((r) => r.id === rd.id)?.status).toBe("neverStarted");
    });

    it("is 'neverStarted' when the only linked donation isn't finalized", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: false,
        datetime: new Date(),
      });

      const { data } = await recurringDonationsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data.find((r) => r.id === rd.id)?.status).toBe("neverStarted");
    });

    it("is 'active' for a recent finalized linked donation", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(),
      });

      const { data } = await recurringDonationsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data.find((r) => r.id === rd.id)?.status).toBe("active");
    });

    it("is 'stopped' once the last finalized payment is over 60 days old", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      const old = new Date();
      old.setDate(old.getDate() - 90);
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: old,
      });

      const { data } = await recurringDonationsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data.find((r) => r.id === rd.id)?.status).toBe("stopped");
    });

    it("sorts by status (neverStarted < stopped < active)", async () => {
      const donor = await createTestDonor();
      const neverStarted = await createTestRecurringDonation({
        donorId: donor.id,
      });
      const stopped = await createTestRecurringDonation({ donorId: donor.id });
      const old = new Date();
      old.setDate(old.getDate() - 90);
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: stopped.id,
        finalized: true,
        datetime: old,
      });
      const active = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: active.id,
        finalized: true,
        datetime: new Date(),
      });

      const { data } = await recurringDonationsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        sortBy: "status",
        sortDir: "asc",
      });
      const ids = data.map((r) => r.id);
      expect(ids.indexOf(neverStarted.id)).toBeLessThan(
        ids.indexOf(stopped.id),
      );
      expect(ids.indexOf(stopped.id)).toBeLessThan(ids.indexOf(active.id));
    });
  });

  // ── findByIdWithFullDonations: status ────────────────────────────────────────

  describe("findByIdWithFullDonations status", () => {
    it("returns undefined for a missing recurring donation", async () => {
      const result =
        await recurringDonationsRepository.findByIdWithFullDonations(999999);
      expect(result).toBeUndefined();
    });

    it("is 'neverStarted' when no donation has ever been linked", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });

      const result =
        await recurringDonationsRepository.findByIdWithFullDonations(rd.id);
      expect(result?.status).toBe("neverStarted");
    });

    it("is 'active' for a recent finalized linked donation", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(),
      });

      const result =
        await recurringDonationsRepository.findByIdWithFullDonations(rd.id);
      expect(result?.status).toBe("active");
    });

    it("is 'stopped' once the last finalized payment is over 60 days old", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      const old = new Date();
      old.setDate(old.getDate() - 90);
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: old,
      });

      const result =
        await recurringDonationsRepository.findByIdWithFullDonations(rd.id);
      expect(result?.status).toBe("stopped");
    });

    it("ignores an unfinalized recent donation", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: false,
        datetime: new Date(),
      });

      const result =
        await recurringDonationsRepository.findByIdWithFullDonations(rd.id);
      expect(result?.status).toBe("neverStarted");
    });
  });

  // ── getGrid: recurringActive ─────────────────────────────────────────────────

  describe("getGrid recurringActive", () => {
    it("is true only for a donor with a recent finalized recurring payment", async () => {
      const daysAgo = (days: number) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
      };

      const active = await createTestDonor({ email: "active@test.com" });
      const activeRd = await createTestRecurringDonation({
        donorId: active.id,
      });
      await createTestDonation({
        donorId: active.id,
        recurringDonationId: activeRd.id,
        finalized: true,
        datetime: daysAgo(10),
      });

      const lapsed = await createTestDonor({ email: "lapsed@test.com" });
      const lapsedRd = await createTestRecurringDonation({
        donorId: lapsed.id,
      });
      await createTestDonation({
        donorId: lapsed.id,
        recurringDonationId: lapsedRd.id,
        finalized: true,
        datetime: daysAgo(90),
      });

      // A recent donation, but a one-off
      const oneOff = await createTestDonor({ email: "oneoff@test.com" });
      await createTestDonation({
        donorId: oneOff.id,
        finalized: true,
        datetime: daysAgo(3),
      });

      // A recent recurring payment that never completed; the one-off puts
      // the donor in the grid at all
      const unfinished = await createTestDonor({
        email: "unfinished@test.com",
      });
      const unfinishedRd = await createTestRecurringDonation({
        donorId: unfinished.id,
      });
      await createTestDonation({
        donorId: unfinished.id,
        recurringDonationId: unfinishedRd.id,
        finalized: false,
        datetime: daysAgo(3),
      });
      await createTestDonation({
        donorId: unfinished.id,
        finalized: true,
        datetime: daysAgo(200),
      });

      const rows = await recurringDonationsRepository.getGrid();
      const flags = Object.fromEntries(
        rows.map((r) => [r.donorId, r.recurringActive]),
      );
      expect(flags).toEqual({
        [active.id]: true,
        [lapsed.id]: false,
        [oneOff.id]: false,
        [unfinished.id]: false,
      });
    });
  });
});
