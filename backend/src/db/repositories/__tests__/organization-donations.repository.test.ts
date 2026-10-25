/**
 * Integration tests for OrganizationDonationsRepository
 *
 * Tests junction table operations for donation splits across organizations.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { organizationDonationsRepository } from "../organization-donations.repository";
import {
  cleanDatabase,
  createTestDonation,
  createTestOrganizationDonation,
} from "../../__tests__/test-db-helper";

describe("OrganizationDonationsRepository", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("create", () => {
    it("should create an organization donation", async () => {
      const donation = await createTestDonation();

      const orgDonation = await organizationDonationsRepository.create({
        donationId: donation.id,
        organizationInternalId: "AMF",
        amount: 5000,
      });

      expect(orgDonation).toBeDefined();
      expect(orgDonation.donationId).toBe(donation.id);
      expect(orgDonation.organizationInternalId).toBe("AMF");
      expect(orgDonation.amount).toBe(5000);
    });
  });

  describe("createMany", () => {
    it("should create multiple organization donations", async () => {
      const donation = await createTestDonation();

      const orgDonations = await organizationDonationsRepository.createMany([
        {
          donationId: donation.id,
          organizationInternalId: "AMF",
          amount: 3000,
        },
        { donationId: donation.id, organizationInternalId: "GD", amount: 2000 },
        { donationId: donation.id, organizationInternalId: "EV", amount: 1000 },
      ]);

      expect(orgDonations).toHaveLength(3);
      expect(orgDonations[0].organizationInternalId).toBe("AMF");
      expect(orgDonations[1].organizationInternalId).toBe("GD");
      expect(orgDonations[2].organizationInternalId).toBe("EV");
      expect(
        orgDonations[0].amount +
          orgDonations[1].amount +
          orgDonations[2].amount,
      ).toBe(6000);
    });

    it("should handle empty array", async () => {
      const result = await organizationDonationsRepository.createMany([]);

      expect(result).toEqual([]);
    });
  });

  describe("findByDonationId", () => {
    it("should find all organization donations for a donation", async () => {
      const donation = await createTestDonation();
      await createTestOrganizationDonation({
        donationId: donation.id,
        organizationInternalId: "AMF",
        amount: 3000,
      });
      await createTestOrganizationDonation({
        donationId: donation.id,
        organizationInternalId: "GD",
        amount: 2000,
      });

      const orgDonations =
        await organizationDonationsRepository.findByDonationId(donation.id);

      expect(orgDonations).toHaveLength(2);
      expect(
        orgDonations.find((od) => od.organizationInternalId === "AMF"),
      ).toBeDefined();
      expect(
        orgDonations.find((od) => od.organizationInternalId === "GD"),
      ).toBeDefined();
    });

    it("should return empty array for donation with no splits", async () => {
      const donation = await createTestDonation();

      const orgDonations =
        await organizationDonationsRepository.findByDonationId(donation.id);

      expect(orgDonations).toEqual([]);
    });
  });

  describe("findByOrganizationInternalId", () => {
    it("should find all donations for an organization", async () => {
      const donation1 = await createTestDonation();
      const donation2 = await createTestDonation();

      await createTestOrganizationDonation({
        donationId: donation1.id,
        organizationInternalId: "AMF",
        amount: 3000,
      });
      await createTestOrganizationDonation({
        donationId: donation2.id,
        organizationInternalId: "AMF",
        amount: 2000,
      });
      await createTestOrganizationDonation({
        donationId: donation1.id,
        organizationInternalId: "GD",
        amount: 1000,
      });

      const orgDonations =
        await organizationDonationsRepository.findByOrganizationInternalId(
          "AMF",
        );

      expect(orgDonations).toHaveLength(2);
      expect(orgDonations[0].amount).toBe(3000);
      expect(orgDonations[1].amount).toBe(2000);
    });
  });

  describe("updateForDonation", () => {
    it("should delete old splits and create new ones", async () => {
      const donation = await createTestDonation();

      // Create initial splits
      await createTestOrganizationDonation({
        donationId: donation.id,
        organizationInternalId: "AMF",
        amount: 5000,
      });

      // Update to new splits
      const updated = await organizationDonationsRepository.updateForDonation(
        donation.id,
        [
          { organizationInternalId: "GD", amount: 3000 },
          { organizationInternalId: "EV", amount: 2000 },
        ],
      );

      expect(updated).toHaveLength(2);

      // Verify old split is gone
      const allSplits = await organizationDonationsRepository.findByDonationId(
        donation.id,
      );
      expect(allSplits).toHaveLength(2);
      expect(
        allSplits.find((od) => od.organizationInternalId === "AMF"),
      ).toBeUndefined();
      expect(
        allSplits.find((od) => od.organizationInternalId === "GD"),
      ).toBeDefined();
      expect(
        allSplits.find((od) => od.organizationInternalId === "EV"),
      ).toBeDefined();
    });

    it("should handle empty update (remove all splits)", async () => {
      const donation = await createTestDonation();
      await createTestOrganizationDonation({
        donationId: donation.id,
        organizationInternalId: "AMF",
        amount: 5000,
      });

      await organizationDonationsRepository.updateForDonation(donation.id, []);

      const splits = await organizationDonationsRepository.findByDonationId(
        donation.id,
      );
      expect(splits).toEqual([]);
    });
  });

  describe("deleteByDonationId", () => {
    it("should delete all organization donations for a donation", async () => {
      const donation = await createTestDonation();
      await createTestOrganizationDonation({
        donationId: donation.id,
        organizationInternalId: "AMF",
        amount: 3000,
      });
      await createTestOrganizationDonation({
        donationId: donation.id,
        organizationInternalId: "GD",
        amount: 2000,
      });

      await organizationDonationsRepository.deleteByDonationId(donation.id);

      const remaining = await organizationDonationsRepository.findByDonationId(
        donation.id,
      );
      expect(remaining).toEqual([]);
    });
  });

  describe("organizationHasDonations", () => {
    it("should return true if organization has donations", async () => {
      const donation = await createTestDonation();
      await createTestOrganizationDonation({
        donationId: donation.id,
        organizationInternalId: "AMF",
        amount: 5000,
      });

      const hasDonations =
        await organizationDonationsRepository.organizationHasDonations("AMF");

      expect(hasDonations).toBe(true);
    });

    it("should return false if organization has no donations", async () => {
      const hasDonations =
        await organizationDonationsRepository.organizationHasDonations(
          "NONEXISTENT",
        );

      expect(hasDonations).toBe(false);
    });
  });

  describe("Donation split integrity", () => {
    it("should correctly split donation amount across organizations", async () => {
      const donation = await createTestDonation({ amount: 10000 });

      await organizationDonationsRepository.createMany([
        {
          donationId: donation.id,
          organizationInternalId: "AMF",
          amount: 4000,
        },
        { donationId: donation.id, organizationInternalId: "GD", amount: 3500 },
        { donationId: donation.id, organizationInternalId: "EV", amount: 2500 },
      ]);

      const splits = await organizationDonationsRepository.findByDonationId(
        donation.id,
      );
      const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);

      expect(totalSplit).toBe(10000); // Total should match donation amount
    });

    it("should handle rounding discrepancies in splits", async () => {
      const donation = await createTestDonation({ amount: 1000 });

      // Simulate 33.33% splits (common case that causes rounding issues)
      await organizationDonationsRepository.createMany([
        { donationId: donation.id, organizationInternalId: "AMF", amount: 334 },
        { donationId: donation.id, organizationInternalId: "GD", amount: 333 },
        { donationId: donation.id, organizationInternalId: "EV", amount: 333 },
      ]);

      const splits = await organizationDonationsRepository.findByDonationId(
        donation.id,
      );
      const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);

      expect(totalSplit).toBe(1000); // Should still total to 1000
    });
  });

  describe("getMonthlyTotals", () => {
    /** Mid-month, `monthsAgo` months before this one, and its "YYYY-MM". */
    function monthsAgo(n: number) {
      const now = new Date();
      const date = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 15, 12),
      );
      return { date, month: date.toISOString().slice(0, 7) };
    }

    async function give(
      organizationInternalId: string,
      amount: number,
      date: Date,
      finalized = true,
    ) {
      const donation = await createTestDonation({
        amount,
        datetime: date,
        finalized,
      });
      await createTestOrganizationDonation({
        donationId: donation.id,
        organizationInternalId,
        amount,
      });
    }

    it("sums each month from the first donation to now, empty months as 0", async () => {
      await give("AMF", 3000, monthsAgo(3).date);
      await give("AMF", 2000, monthsAgo(3).date);
      await give("AMF", 500, monthsAgo(1).date);

      expect(
        await organizationDonationsRepository.getMonthlyTotals("AMF"),
      ).toEqual([
        { month: monthsAgo(3).month, total: 5000, count: 2 },
        { month: monthsAgo(2).month, total: 0, count: 0 },
        { month: monthsAgo(1).month, total: 500, count: 1 },
        { month: monthsAgo(0).month, total: 0, count: 0 },
      ]);
    });

    it("counts only finalized donations to that organization", async () => {
      await give("AMF", 1000, monthsAgo(0).date);
      await give("AMF", 7000, monthsAgo(0).date, false);
      await give("GD", 9000, monthsAgo(0).date);

      expect(
        await organizationDonationsRepository.getMonthlyTotals("AMF"),
      ).toEqual([{ month: monthsAgo(0).month, total: 1000, count: 1 }]);
    });

    it("is empty for an organization that got nothing", async () => {
      await give("AMF", 7000, monthsAgo(2).date, false);

      expect(
        await organizationDonationsRepository.getMonthlyTotals("AMF"),
      ).toEqual([]);
      expect(
        await organizationDonationsRepository.getMonthlyTotals("NONE"),
      ).toEqual([]);
    });
  });
});
