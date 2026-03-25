/**
 * Integration tests for DonationTransfersRepository
 *
 * Covers the two new admin-panel query methods: findPaginated and
 * findByIdWithPerOrgTotals. These tests hit the real test database.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { donationTransfersRepository } from "../donation-transfers.repository";
import {
  cleanDatabase,
  createTestDonor,
  createTestDonation,
  createTestOrganizationDonation,
  createTestDonationTransfer,
} from "../../__tests__/test-db-helper";

describe("DonationTransfersRepository", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // ── findPaginated ────────────────────────────────────────────────────────────

  describe("findPaginated", () => {
    it("returns empty page when no transfers exist", async () => {
      const { data, total } = await donationTransfersRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data).toHaveLength(0);
      expect(total).toBe(0);
    });

    it("returns transfers with zero counts when no donations are linked", async () => {
      await createTestDonationTransfer({ datetime: "2025-01-01" });
      await createTestDonationTransfer({ datetime: "2025-02-01" });

      const { data, total } = await donationTransfersRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });

      expect(total).toBe(2);
      expect(data).toHaveLength(2);
      // donationCount and totalAmount should be null/0 when no donations
      for (const row of data) {
        expect(row.donationCount == null || row.donationCount === 0).toBe(true);
        expect(row.totalAmount == null || row.totalAmount === 0).toBe(true);
      }
    });

    it("computes correct donationCount and totalAmount from finalized donations only", async () => {
      const transfer = await createTestDonationTransfer({
        datetime: "2025-03-01",
      });

      // 2 finalized donations linked to the transfer
      await createTestDonation({
        donationTransferId: transfer.id,
        finalized: true,
        amount: 1000,
      });
      await createTestDonation({
        donationTransferId: transfer.id,
        finalized: true,
        amount: 2000,
      });
      // 1 unfinalized donation — must NOT be counted
      await createTestDonation({
        donationTransferId: transfer.id,
        finalized: false,
        amount: 9999,
      });

      const { data, total } = await donationTransfersRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });

      expect(total).toBe(1);
      const row = data[0]!;
      expect(row.donationCount).toBe(2);
      expect(row.totalAmount).toBe(3000);
    });

    it("respects pagination limits", async () => {
      // Create 5 transfers
      for (let i = 1; i <= 5; i++) {
        await createTestDonationTransfer({
          datetime: `2025-0${i}-01`,
        });
      }

      const page1 = await donationTransfersRepository.findPaginated({
        page: 1,
        pageSize: 3,
      });
      const page2 = await donationTransfersRepository.findPaginated({
        page: 2,
        pageSize: 3,
      });

      expect(page1.total).toBe(5);
      expect(page1.data).toHaveLength(3);
      expect(page2.data).toHaveLength(2);
    });

    it("sorts by datetime descending by default", async () => {
      await createTestDonationTransfer({ datetime: "2025-01-01" });
      await createTestDonationTransfer({ datetime: "2025-03-01" });
      await createTestDonationTransfer({ datetime: "2025-02-01" });

      const { data } = await donationTransfersRepository.findPaginated({
        page: 1,
        pageSize: 25,
        sortBy: "datetime",
        sortDir: "desc",
      });

      expect(data[0]!.datetime).toBe("2025-03-01");
      expect(data[1]!.datetime).toBe("2025-02-01");
      expect(data[2]!.datetime).toBe("2025-01-01");
    });
  });

  // ── findByIdWithPerOrgTotals ─────────────────────────────────────────────────

  describe("findByIdWithPerOrgTotals", () => {
    it("returns undefined for a non-existent transfer", async () => {
      const result =
        await donationTransfersRepository.findByIdWithPerOrgTotals(99999);
      expect(result).toBeUndefined();
    });

    it("returns the transfer with empty orgTotals when no donations are linked", async () => {
      const transfer = await createTestDonationTransfer({
        datetime: "2025-01-01",
        recipient: "GWWC",
      });

      const result = await donationTransfersRepository.findByIdWithPerOrgTotals(
        transfer.id,
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe(transfer.id);
      expect(result!.recipient).toBe("GWWC");
      expect(result!.orgTotals).toHaveLength(0);
      expect(result!.donations).toHaveLength(0);
    });

    it("computes per-org totals from finalized donations only", async () => {
      const transfer = await createTestDonationTransfer({
        datetime: "2025-02-01",
      });

      // Finalized donation split across two orgs
      const d1 = await createTestDonation({
        donationTransferId: transfer.id,
        finalized: true,
        amount: 5000,
      });
      await createTestOrganizationDonation({
        donationId: d1.id,
        organizationInternalId: "AMF",
        amount: 3000,
      });
      await createTestOrganizationDonation({
        donationId: d1.id,
        organizationInternalId: "GD",
        amount: 2000,
      });

      // Another finalized donation going entirely to AMF
      const d2 = await createTestDonation({
        donationTransferId: transfer.id,
        finalized: true,
        amount: 1000,
      });
      await createTestOrganizationDonation({
        donationId: d2.id,
        organizationInternalId: "AMF",
        amount: 1000,
      });

      // Unfinalized donation — must NOT appear in totals
      const d3 = await createTestDonation({
        donationTransferId: transfer.id,
        finalized: false,
        amount: 9999,
      });
      await createTestOrganizationDonation({
        donationId: d3.id,
        organizationInternalId: "AMF",
        amount: 9999,
      });

      const result = await donationTransfersRepository.findByIdWithPerOrgTotals(
        transfer.id,
      );

      expect(result).toBeDefined();
      const totals = result!.orgTotals;

      // AMF: 3000 + 1000 = 4000 (largest, comes first)
      const amf = totals.find((t) => t.organizationInternalId === "AMF");
      expect(amf).toBeDefined();
      expect(amf!.total).toBe(4000);
      expect(amf!.donationCount).toBe(2);

      // GD: 2000
      const gd = totals.find((t) => t.organizationInternalId === "GD");
      expect(gd).toBeDefined();
      expect(gd!.total).toBe(2000);
      expect(gd!.donationCount).toBe(1);

      // Totals sorted by amount descending — AMF first
      expect(totals[0]!.organizationInternalId).toBe("AMF");
    });

    it("includes all linked donations in the donations array", async () => {
      const transfer = await createTestDonationTransfer({
        datetime: "2025-03-01",
      });

      await createTestDonation({
        donationTransferId: transfer.id,
        finalized: true,
        amount: 500,
      });
      await createTestDonation({
        donationTransferId: transfer.id,
        finalized: false,
        amount: 750,
      });

      const result = await donationTransfersRepository.findByIdWithPerOrgTotals(
        transfer.id,
      );

      // Both finalized and unfinalized donations appear in the list
      expect(result!.donations).toHaveLength(2);
    });
  });
});
