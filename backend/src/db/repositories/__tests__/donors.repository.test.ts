/**
 * Integration tests for DonorsRepository
 *
 * Tests donor CRUD operations and lookups (critical for payment flow).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { donorsRepository, lastCompleteMonthRange } from "../donors.repository";
import {
  cleanDatabase,
  createTestDonor,
  createTestDonation,
  createTestRecurringDonation,
} from "../../__tests__/test-db-helper";

describe("DonorsRepository", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("create", () => {
    it("should create a donor with all required fields", async () => {
      const donor = await donorsRepository.create({
        idCode: "38207162722",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      });

      expect(donor).toBeDefined();
      expect(donor.id).toBeDefined();
      expect(donor.idCode).toBe("38207162722");
      expect(donor.firstName).toBe("Jane");
      expect(donor.lastName).toBe("Doe");
      expect(donor.email).toBe("jane@example.com");
    });
  });

  describe("findById", () => {
    it("should find a donor by ID", async () => {
      const created = await createTestDonor({ firstName: "Alice" });

      const found = await donorsRepository.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.firstName).toBe("Alice");
    });

    it("should return undefined for non-existent ID", async () => {
      const found = await donorsRepository.findById(99999);

      expect(found).toBeUndefined();
    });
  });

  describe("findByIdCode", () => {
    it("should find a donor by Estonian ID code", async () => {
      await createTestDonor({ idCode: "38207162722", firstName: "Test" });

      const found = await donorsRepository.findByIdCode("38207162722");

      expect(found).toBeDefined();
      expect(found.idCode).toBe("38207162722");
      expect(found.firstName).toBe("Test");
    });

    it("should find a donor by company code (non-11-char)", async () => {
      await createTestDonor({ idCode: "12345678", firstName: "Company" });

      const found = await donorsRepository.findByIdCode("12345678");

      expect(found).toBeDefined();
      expect(found.idCode).toBe("12345678");
    });

    it("should return undefined for non-existent ID code", async () => {
      const found = await donorsRepository.findByIdCode("99999999999");

      expect(found).toBeUndefined();
    });
  });

  describe("findByEmail", () => {
    it("should find a donor by email", async () => {
      await createTestDonor({
        email: "unique@example.com",
        firstName: "Unique",
      });

      const found = await donorsRepository.findByEmail("unique@example.com");

      expect(found).toBeDefined();
      expect(found.email).toBe("unique@example.com");
      expect(found.firstName).toBe("Unique");
    });

    it("should return undefined for non-existent email", async () => {
      const found = await donorsRepository.findByEmail(
        "nonexistent@example.com",
      );

      expect(found).toBeUndefined();
    });
  });

  describe("update", () => {
    it("should update donor fields", async () => {
      const donor = await createTestDonor({
        firstName: "Old",
        email: "old@example.com",
      });

      const updated = await donorsRepository.update(donor.id, {
        firstName: "New",
        email: "new@example.com",
      });

      expect(updated).toBeDefined();
      expect(updated.firstName).toBe("New");
      expect(updated.email).toBe("new@example.com");
      expect(updated.lastName).toBe(donor.lastName); // Unchanged
    });
  });

  describe("ID code validation scenarios", () => {
    it("should handle valid Estonian personal ID codes", async () => {
      const validIdCodes = ["38207162722", "50208130249", "39912319873"];

      for (const idCode of validIdCodes) {
        const donor = await donorsRepository.create({
          idCode,
          firstName: "Test",
          lastName: "User",
          email: `${idCode}@example.com`,
        });

        expect(donor.idCode).toBe(idCode);
      }
    });

    it("should handle company codes (non-personal)", async () => {
      const companyCodes = [
        "12345678", // 8-digit company code
        "1234567890", // 10-digit code
      ];

      for (const idCode of companyCodes) {
        const donor = await donorsRepository.create({
          idCode,
          firstName: "Company",
          lastName: "Name",
          email: `${idCode}@company.com`,
        });

        expect(donor.idCode).toBe(idCode);
      }
    });
  });

  describe("Email format scenarios", () => {
    it("should accept various valid email formats", async () => {
      const validEmails = [
        "simple@example.com",
        "first.last@example.com",
        "user+tag@example.co.uk",
        "name123@test-domain.com",
      ];

      for (let i = 0; i < validEmails.length; i++) {
        const donor = await donorsRepository.create({
          idCode: `1234567${i}`,
          firstName: "Test",
          lastName: "User",
          email: validEmails[i],
        });

        expect(donor.email).toBe(validEmails[i]);
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle donors with very long names", async () => {
      const donor = await donorsRepository.create({
        idCode: "38207162722",
        firstName: "A".repeat(128),
        lastName: "B".repeat(128),
        email: "test@example.com",
      });

      expect(donor.firstName.length).toBe(128);
      expect(donor.lastName.length).toBe(128);
    });

    it("should handle special characters in names", async () => {
      const donor = await donorsRepository.create({
        idCode: "38207162722",
        firstName: "Jüri",
        lastName: "Õunapuu-Käär",
        email: "test@example.com",
      });

      expect(donor.firstName).toBe("Jüri");
      expect(donor.lastName).toBe("Õunapuu-Käär");
    });
  });

  // ── findPaginated: recurringDonor ────────────────────────────────────────────
  //
  // "Recurring donor" is computed from payment activity — a finalized donation
  // tied to a recurring donation within the last 60 days — not the deprecated
  // recurring_donations.active flag (donors.recurringDonor, the other
  // deprecated signal this used to also ignore, has since been dropped from
  // the schema entirely). Each test below isolates one of those distinctions.

  describe("findPaginated recurringDonor", () => {
    it("is true for a donor with a recent finalized recurring payment", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(),
      });

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data.find((d) => d.id === donor.id)?.recurringDonor).toBe(true);
    });

    it("is false once the last recurring payment is over 60 days old", async () => {
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

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data.find((d) => d.id === donor.id)?.recurringDonor).toBe(false);
    });

    it("is false for a donor whose only donation isn't linked to a recurring donation", async () => {
      const donor = await createTestDonor();
      await createTestDonation({
        donorId: donor.id,
        finalized: true,
        datetime: new Date(),
      });

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data.find((d) => d.id === donor.id)?.recurringDonor).toBe(false);
    });

    it("ignores the deprecated recurring_donations.active flag", async () => {
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

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
      });
      expect(data.find((d) => d.id === donor.id)?.recurringDonor).toBe(true);
    });

    it("filters by recurringDonor", async () => {
      const recurring = await createTestDonor({
        email: "recurring@example.com",
      });
      const rd = await createTestRecurringDonation({ donorId: recurring.id });
      await createTestDonation({
        donorId: recurring.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(),
      });
      const oneOff = await createTestDonor({ email: "one-off@example.com" });
      await createTestDonation({
        donorId: oneOff.id,
        finalized: true,
        datetime: new Date(),
      });

      const onlyRecurring = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringDonor: true,
      });
      expect(onlyRecurring.data.map((d) => d.id)).toEqual([recurring.id]);

      const onlyOneOff = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringDonor: false,
      });
      expect(onlyOneOff.data.map((d) => d.id)).toEqual([oneOff.id]);
    });
  });

  // ── findPaginated: recurringStatus ────────────────────────────────────────────
  //
  // "new"/"retained"/"churned" as of the last complete calendar month — a
  // fixed cohort comparison, distinct from the 60-day recurringDonor window
  // above (the two can legitimately disagree near the boundary).

  describe("findPaginated recurringStatus", () => {
    it("is 'new' for a donor active last month but not the month before", async () => {
      const { refStart } = lastCompleteMonthRange();
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(refStart.getTime() + 24 * 60 * 60 * 1000),
      });

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringStatus: "new",
      });
      expect(data.map((d) => d.id)).toEqual([donor.id]);
    });

    it("is 'retained' for a donor active both last month and the month before", async () => {
      const { priorStart, refStart } = lastCompleteMonthRange();
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(priorStart.getTime() + 24 * 60 * 60 * 1000),
      });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(refStart.getTime() + 24 * 60 * 60 * 1000),
      });

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringStatus: "retained",
      });
      expect(data.map((d) => d.id)).toEqual([donor.id]);
    });

    it("is 'churned' for a donor active the month before last but not last month", async () => {
      const { priorStart } = lastCompleteMonthRange();
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(priorStart.getTime() + 24 * 60 * 60 * 1000),
      });

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringStatus: "churned",
      });
      expect(data.map((d) => d.id)).toEqual([donor.id]);
    });

    it("excludes a donor active in neither reference month from every status filter", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      const longAgo = new Date();
      longAgo.setFullYear(longAgo.getFullYear() - 1);
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: longAgo,
      });

      for (const status of ["new", "retained", "churned"] as const) {
        const { data } = await donorsRepository.findPaginated({
          page: 1,
          pageSize: 25,
          recurringStatus: status,
        });
        expect(data.map((d) => d.id)).not.toContain(donor.id);
      }
    });

    it("ignores donations not tied to a recurring donation", async () => {
      const { refStart } = lastCompleteMonthRange();
      const donor = await createTestDonor();
      await createTestDonation({
        donorId: donor.id,
        finalized: true,
        datetime: new Date(refStart.getTime() + 24 * 60 * 60 * 1000), // no recurringDonationId
      });

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringStatus: "new",
      });
      expect(data.map((d) => d.id)).not.toContain(donor.id);
    });
  });

  // ── findPaginated: recurringStatus churnedAllTime ───────────────────────────
  //
  // Ever had a recurring-linked payment, but nothing within the current
  // 60-day window — unlike "churned" (last month specifically), this catches
  // a donor who stopped at any point in the past.

  describe("findPaginated recurringStatus churnedAllTime", () => {
    it("is true for a donor whose last recurring payment is long past the 60-day window", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      const longAgo = new Date();
      longAgo.setFullYear(longAgo.getFullYear() - 1);
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: longAgo,
      });

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringStatus: "churnedAllTime",
      });
      expect(data.map((d) => d.id)).toContain(donor.id);
    });

    it("differs from 'churned' (last month) for a donor who stopped over a year ago", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      const longAgo = new Date();
      longAgo.setFullYear(longAgo.getFullYear() - 1);
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: longAgo,
      });

      const lastMonthChurned = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringStatus: "churned",
      });
      const allTimeChurned = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringStatus: "churnedAllTime",
      });
      expect(lastMonthChurned.data.map((d) => d.id)).not.toContain(donor.id);
      expect(allTimeChurned.data.map((d) => d.id)).toContain(donor.id);
    });

    it("excludes a donor currently within the 60-day window", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(),
      });

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringStatus: "churnedAllTime",
      });
      expect(data.map((d) => d.id)).not.toContain(donor.id);
    });

    it("excludes a donor who never had a recurring-linked donation", async () => {
      const donor = await createTestDonor();
      await createTestDonation({
        donorId: donor.id,
        finalized: true,
        datetime: new Date(),
      });

      const { data } = await donorsRepository.findPaginated({
        page: 1,
        pageSize: 25,
        recurringStatus: "churnedAllTime",
      });
      expect(data.map((d) => d.id)).not.toContain(donor.id);
    });
  });

  // ── findByIdWithDonations: recurringDonor ────────────────────────────────────
  //
  // Same payment-based definition as findPaginated, just computed in JS from
  // the already-fetched donations instead of a second query.

  describe("findByIdWithDonations recurringDonor", () => {
    it("returns undefined for a missing donor", async () => {
      const result = await donorsRepository.findByIdWithDonations(999999);
      expect(result).toBeUndefined();
    });

    it("is true for a donor with a recent finalized recurring payment", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({ donorId: donor.id });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(),
      });

      const result = await donorsRepository.findByIdWithDonations(donor.id);
      expect(result?.recurringDonor).toBe(true);
    });

    it("is false once the last recurring payment is over 60 days old", async () => {
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

      const result = await donorsRepository.findByIdWithDonations(donor.id);
      expect(result?.recurringDonor).toBe(false);
    });

    it("ignores the deprecated recurring_donations.active flag", async () => {
      const donor = await createTestDonor();
      const rd = await createTestRecurringDonation({
        donorId: donor.id,
        active: false,
      });
      await createTestDonation({
        donorId: donor.id,
        recurringDonationId: rd.id,
        finalized: true,
        datetime: new Date(),
      });

      const result = await donorsRepository.findByIdWithDonations(donor.id);
      expect(result?.recurringDonor).toBe(true);
    });
  });
});

// ── lastCompleteMonthRange (pure — no DB) ───────────────────────────────────────

function iso(d: Date): string {
  return d.toISOString();
}

describe("lastCompleteMonthRange", () => {
  it("returns the prior and reference (last complete) month boundaries", () => {
    const { priorStart, refStart, refEnd } = lastCompleteMonthRange(
      new Date("2026-03-17T09:00:00Z"),
    );
    expect(iso(priorStart)).toBe("2026-01-01T00:00:00.000Z");
    expect(iso(refStart)).toBe("2026-02-01T00:00:00.000Z");
    expect(iso(refEnd)).toBe("2026-03-01T00:00:00.000Z");
  });

  it("crosses a year boundary", () => {
    const { priorStart, refStart, refEnd } = lastCompleteMonthRange(
      new Date("2026-01-15T09:00:00Z"),
    );
    expect(iso(priorStart)).toBe("2025-11-01T00:00:00.000Z");
    expect(iso(refStart)).toBe("2025-12-01T00:00:00.000Z");
    expect(iso(refEnd)).toBe("2026-01-01T00:00:00.000Z");
  });
});
