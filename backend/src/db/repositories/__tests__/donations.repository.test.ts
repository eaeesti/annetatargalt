/**
 * Integration tests for DonationsRepository
 *
 * These tests interact with the actual database (test database).
 * They verify CRUD operations, complex queries, and data integrity.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { donationsRepository } from "../donations.repository";
import { donorsRepository } from "../donors.repository";
import { organizationDonationsRepository } from "../organization-donations.repository";
import {
  cleanDatabase,
  createTestDonor,
  createTestDonation,
  createTestOrganizationDonation,
  createTestDonationTransfer,
} from "../../__tests__/test-db-helper";

describe("DonationsRepository", () => {
  beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();
  });

  describe("create", () => {
    it("should create a donation with all required fields", async () => {
      const donor = await createTestDonor();

      const donation = await donationsRepository.create({
        donorId: donor.id,
        amount: 5000, // 50.00 EUR
        datetime: new Date("2025-01-15T10:00:00Z"),
        finalized: true,
        paymentMethod: "bank_transfer",
      });

      expect(donation).toBeDefined();
      expect(donation.id).toBeDefined();
      expect(donation.donorId).toBe(donor.id);
      expect(donation.amount).toBe(5000);
      expect(donation.finalized).toBe(true);
      expect(donation.paymentMethod).toBe("bank_transfer");
    });

    it("should create a donation with nullable donorId", async () => {
      const donation = await donationsRepository.create({
        donorId: null,
        amount: 2500,
        datetime: new Date(),
        finalized: false,
      });

      expect(donation).toBeDefined();
      expect(donation.donorId).toBeNull();
      expect(donation.amount).toBe(2500);
    });

    it("should create a donation with all optional fields", async () => {
      const donor = await createTestDonor();

      const donation = await donationsRepository.create({
        donorId: donor.id,
        amount: 10000,
        datetime: new Date(),
        finalized: true,
        paymentMethod: "montonio",
        iban: "EE123456789012345678",
        comment: "Test donation",
        companyName: "Test Company",
        companyCode: "12345678",
        dedicationName: "John Doe",
        dedicationEmail: "john@example.com",
        dedicationMessage: "Happy Birthday!",
        externalDonation: true,
      });

      expect(donation).toBeDefined();
      expect(donation.iban).toBe("EE123456789012345678");
      expect(donation.comment).toBe("Test donation");
      expect(donation.companyName).toBe("Test Company");
      expect(donation.dedicationMessage).toBe("Happy Birthday!");
      expect(donation.externalDonation).toBe(true);
    });
  });

  describe("findById", () => {
    it("should find a donation by ID", async () => {
      const created = await createTestDonation({ amount: 7500 });

      const found = await donationsRepository.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.amount).toBe(7500);
    });

    it("should return undefined for non-existent ID", async () => {
      const found = await donationsRepository.findById(99999);

      expect(found).toBeUndefined();
    });
  });

  describe("findByIdWithRelations", () => {
    it("should find donation with donor and organizationDonations", async () => {
      const donor = await createTestDonor();
      const donation = await createTestDonation({
        donorId: donor.id,
        amount: 5000,
      });
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

      const found = await donationsRepository.findByIdWithRelations(
        donation.id
      );

      expect(found).toBeDefined();
      expect(found.donor).toBeDefined();
      expect(found.donor.id).toBe(donor.id);
      expect(found.organizationDonations).toHaveLength(2);
      expect(found.organizationDonations[0].organizationInternalId).toBe("AMF");
      expect(found.organizationDonations[1].organizationInternalId).toBe("GD");
    });
  });

  describe("update", () => {
    it("should update donation fields", async () => {
      const donation = await createTestDonation({ finalized: false });

      const updated = await donationsRepository.update(donation.id, {
        finalized: true,
        paymentMethod: "montonio",
      });

      expect(updated).toBeDefined();
      expect(updated.finalized).toBe(true);
      expect(updated.paymentMethod).toBe("montonio");
    });
  });

  describe("finalize", () => {
    it("should mark donation as finalized", async () => {
      const donation = await createTestDonation({ finalized: false });

      const finalized = await donationsRepository.finalize(donation.id);

      expect(finalized.finalized).toBe(true);
    });
  });

  describe("addToTransfer", () => {
    it("should add multiple donations to a transfer", async () => {
      const transfer = await createTestDonationTransfer();
      const donation1 = await createTestDonation();
      const donation2 = await createTestDonation();
      const donation3 = await createTestDonation();

      const updated = await donationsRepository.addToTransfer(
        [donation1.id, donation2.id, donation3.id],
        transfer.id
      );

      expect(updated).toHaveLength(3);
      expect(updated[0].donationTransferId).toBe(transfer.id);
      expect(updated[1].donationTransferId).toBe(transfer.id);
      expect(updated[2].donationTransferId).toBe(transfer.id);
    });

    it("should handle empty donation IDs array", async () => {
      const updated = await donationsRepository.addToTransfer([], 1);

      expect(updated).toEqual([]);
    });
  });

  describe("sumFinalizedDonations", () => {
    it("should sum all finalized donations", async () => {
      const donor = await createTestDonor();

      // Create finalized donations
      const donation1 = await createTestDonation({
        donorId: donor.id,
        amount: 5000,
        finalized: true,
      });
      const donation2 = await createTestDonation({
        donorId: donor.id,
        amount: 3000,
        finalized: true,
      });

      // Create unfinalized donation (should not be counted)
      await createTestDonation({
        donorId: donor.id,
        amount: 2000,
        finalized: false,
      });

      const total = await donationsRepository.sumFinalizedDonations();

      expect(total).toBe(8000); // 5000 + 3000
    });

    it("should exclude organizations by internalId", async () => {
      const donor = await createTestDonor();

      // Donation 1: AMF (3000) + GD (2000) = 5000 total
      const donation1 = await createTestDonation({
        donorId: donor.id,
        amount: 5000,
        finalized: true,
      });
      await createTestOrganizationDonation({
        donationId: donation1.id,
        organizationInternalId: "AMF",
        amount: 3000,
      });
      await createTestOrganizationDonation({
        donationId: donation1.id,
        organizationInternalId: "GD",
        amount: 2000,
      });

      // Donation 2: TIP (1000) = 1000 total
      const donation2 = await createTestDonation({
        donorId: donor.id,
        amount: 1000,
        finalized: true,
      });
      await createTestOrganizationDonation({
        donationId: donation2.id,
        organizationInternalId: "TIP",
        amount: 1000,
      });

      // Exclude TIP organization
      const total = await donationsRepository.sumFinalizedDonations({
        excludeOrganizationInternalIds: ["TIP"],
      });

      expect(total).toBe(5000); // Only donation1's organization donations (AMF + GD)
    });

    it("should filter by externalDonation flag", async () => {
      await createTestDonation({
        amount: 5000,
        finalized: true,
        externalDonation: false,
      });
      await createTestDonation({
        amount: 3000,
        finalized: true,
        externalDonation: true,
      });

      const total = await donationsRepository.sumFinalizedDonations({
        externalDonation: false,
      });

      expect(total).toBe(5000); // Only non-external donation
    });

    it("should return 0 for no matching donations", async () => {
      const total = await donationsRepository.sumFinalizedDonations();

      expect(total).toBe(0);
    });
  });

  describe("sumFinalizedDonationsInRange", () => {
    it("should sum donations within date range", async () => {
      await createTestDonation({
        amount: 5000,
        finalized: true,
        datetime: new Date("2025-01-10"),
      });
      await createTestDonation({
        amount: 3000,
        finalized: true,
        datetime: new Date("2025-01-15"),
      });
      await createTestDonation({
        amount: 2000,
        finalized: true,
        datetime: new Date("2025-01-25"), // Outside range
      });

      const total = await donationsRepository.sumFinalizedDonationsInRange({
        dateFrom: "2025-01-01",
        dateTo: "2025-01-20",
      });

      expect(total).toBe(8000); // 5000 + 3000
    });

    it("should handle Date objects", async () => {
      await createTestDonation({
        amount: 4000,
        finalized: true,
        datetime: new Date("2025-02-15"),
      });

      const total = await donationsRepository.sumFinalizedDonationsInRange({
        dateFrom: new Date("2025-02-01"),
        dateTo: new Date("2025-02-28"),
      });

      expect(total).toBe(4000);
    });
  });

  describe("findByDateRange", () => {
    it("should find donations within date range", async () => {
      await createTestDonation({
        datetime: new Date("2025-01-10"),
        amount: 1000,
      });
      await createTestDonation({
        datetime: new Date("2025-01-15"),
        amount: 2000,
      });
      await createTestDonation({
        datetime: new Date("2025-01-25"),
        amount: 3000,
      });

      const donations = await donationsRepository.findByDateRange(
        "2025-01-01",
        "2025-01-20"
      );

      expect(donations).toHaveLength(2);
      expect(donations[0].amount).toBe(2000); // Ordered by datetime desc
      expect(donations[1].amount).toBe(1000);
    });

    it("should include donor information", async () => {
      const donor = await createTestDonor({
        firstName: "Jane",
        lastName: "Smith",
      });
      await createTestDonation({
        donorId: donor.id,
        datetime: new Date("2025-01-15"),
      });

      const donations = await donationsRepository.findByDateRange(
        "2025-01-01",
        "2025-01-31"
      );

      expect(donations).toHaveLength(1);
      expect(donations[0].donor).toBeDefined();
      expect(donations[0].donor.firstName).toBe("Jane");
      expect(donations[0].donor.lastName).toBe("Smith");
    });
  });

  describe("Edge cases", () => {
    it("should handle very large amounts", async () => {
      const donation = await createTestDonation({ amount: 999999999 });

      const found = await donationsRepository.findById(donation.id);

      expect(found.amount).toBe(999999999);
    });

    it("should handle donations with all null optional fields", async () => {
      const donation = await donationsRepository.create({
        donorId: null,
        amount: 1000,
        datetime: new Date(),
        finalized: false,
        paymentMethod: null,
        iban: null,
        comment: null,
        companyName: null,
        companyCode: null,
        dedicationName: null,
        dedicationEmail: null,
        dedicationMessage: null,
      });

      expect(donation).toBeDefined();
      expect(donation.paymentMethod).toBeNull();
      expect(donation.iban).toBeNull();
      expect(donation.comment).toBeNull();
    });
  });
});
