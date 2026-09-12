/**
 * Integration tests for RecurringDonationsRepository — status computation.
 *
 * "status" (findPaginated + findByIdWithFullDonations) is payment-based: a
 * finalized donation linked to the recurring donation within the current
 * RECURRING_ACTIVITY_WINDOW_DAYS window means "active"; one ever, but not
 * recently, means "stopped"; none ever means "neverStarted". Not the
 * deprecated recurring_donations.active column — it's never updated after
 * creation in current application code, so it drifts from reality.
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

    it("ignores the deprecated active column", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({
        donorId: donor.id,
        active: true, // deprecated flag says active — but no payment at all
      });

      const { data } = await recurringDonationsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data.find((r) => r.id === rd.id)?.status).toBe("neverStarted");
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

    it("ignores the deprecated active column", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({
        donorId: donor.id,
        active: false, // deprecated flag says inactive
      });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(), // but a real payment just came in
      });

      const result =
        await recurringDonationsRepository.findByIdWithFullDonations(rd.id);
      expect(result?.status).toBe("active");
    });
  });
});
