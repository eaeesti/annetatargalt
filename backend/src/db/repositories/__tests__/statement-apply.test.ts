/**
 * Integration tests for the bank-statement import's apply step. It isn't a
 * repository, but it needs the test database, which only the tests in this
 * folder get.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Core } from "@strapi/strapi";
import { eq } from "drizzle-orm";
import { db } from "../../client";
import { donations, donors, recurringDonations } from "../../schema";
import { donorsRepository } from "../donors.repository";
import { createStatementService } from "../../../plugins/admin-panel/server/services/statement";
import {
  cleanDatabase,
  createTestDonor,
  createTestRecurringDonation,
  createTestOrganizationRecurringDonation,
} from "../../__tests__/test-db-helper";

// Apply only reads and writes the donations database, never Strapi.
// oxlint-disable-next-line typescript/consistent-type-assertions
const statement = createStatementService({} as unknown as Core.Strapi);

/** A standing-order payment on the statement, as the preview echoes it. */
const LINE = {
  archivingCode: "2026100500000001",
  entryReference: "1",
  date: "2026-10-05",
  amountCents: 2000,
  description: "Monthly donation",
  counterpartyName: "Test Donor",
  counterpartyAccount: "EE000000000000000001",
  idOrRegCode: "38207162722",
  direction: "C",
};

/** A donor whose standing order LINE is a payment of; their id. */
async function donorWithStandingOrder(newsletter: boolean | null = null) {
  const donor = await createTestDonor();
  const template = await createTestRecurringDonation({
    donorId: donor.id,
    amount: 2000,
    datetime: new Date("2026-09-01T10:00:00Z"),
    newsletter,
  });
  await createTestOrganizationRecurringDonation({
    recurringDonationId: template.id,
    organizationInternalId: "test-org",
    amount: 2000,
  });
  return donor.id;
}

/** The apply request that imports LINE as a payment of `donorId`. */
function importing(donorId: number, extra: Record<string, unknown> = {}) {
  return {
    allCredits: [LINE],
    recurringImports: [{ transaction: LINE, donorId }],
    ...extra,
  };
}

const donationsOnLine = () =>
  db
    .select()
    .from(donations)
    .where(eq(donations.transactionId, LINE.archivingCode));

describe("statement apply", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("imports a standing-order payment as one donation", async () => {
    const donorId = await donorWithStandingOrder();

    const summary = await statement.apply(
      importing(donorId),
      "team@example.org",
    );

    expect(summary.created).toBe(1);
    expect(await donationsOnLine()).toMatchObject([
      { donorId, amount: 2000, finalized: true },
    ]);
  });

  it("applies a standing order's yes to the newsletter with its first payment, once", async () => {
    const donorId = await donorWithStandingOrder(true);
    await db
      .update(donors)
      .set({ newsletter: false })
      .where(eq(donors.id, donorId));

    await statement.apply(importing(donorId), "team@example.org");

    expect((await donorsRepository.findById(donorId))?.newsletter).toBe(true);
    const [template] = await db
      .select()
      .from(recurringDonations)
      .where(eq(recurringDonations.donorId, donorId));
    expect(template?.newsletter).toBeNull();
  });

  it("lets a change in the settings since the order was set up stand", async () => {
    const donorId = await donorWithStandingOrder(true);
    await donorsRepository.updateEmailPreferences(donorId, {
      newsletter: false,
    });

    await statement.apply(importing(donorId), "team@example.org");

    expect((await donorsRepository.findById(donorId))?.newsletter).toBe(false);
  });

  it("keeps a standing order's waiting yes when only other emails change", async () => {
    const donorId = await donorWithStandingOrder(true);
    await db
      .update(donors)
      .set({ newsletter: false })
      .where(eq(donors.id, donorId));
    await donorsRepository.updateEmailPreferences(donorId, {
      yearlyEmails: false,
    });

    await statement.apply(importing(donorId), "team@example.org");

    expect((await donorsRepository.findById(donorId))?.newsletter).toBe(true);
  });

  it("cancels a standing order's waiting yes with a later no", async () => {
    const donorId = await donorWithStandingOrder(true);

    await donorsRepository.setNewsletter(donorId, false);

    const [template] = await db
      .select()
      .from(recurringDonations)
      .where(eq(recurringDonations.donorId, donorId));
    expect(template?.newsletter).toBeNull();
  });

  it("saves a payment in its standing order's language", async () => {
    const donor = await createTestDonor();
    const order = await createTestRecurringDonation({
      donorId: donor.id,
      amount: 2000,
      datetime: new Date("2026-09-01T10:00:00Z"),
      locale: "en",
    });
    await createTestOrganizationRecurringDonation({
      recurringDonationId: order.id,
      organizationInternalId: "test-org",
      amount: 2000,
    });

    await statement.apply(importing(donor.id), "team@example.org");

    const [donation] = await donationsOnLine();
    expect(donation?.locale).toBe("en");
  });

  it("doesn't import a line again when the statement is applied twice", async () => {
    const donorId = await donorWithStandingOrder();
    await statement.apply(importing(donorId), "team@example.org");

    await expect(
      statement.apply(importing(donorId), "team@example.org"),
    ).rejects.toThrow("already has a donation");
    expect(await donationsOnLine()).toHaveLength(1);
  });

  it("imports a line once when two applies of it run at the same time", async () => {
    const donorId = await donorWithStandingOrder();

    const results = await Promise.allSettled([
      statement.apply(importing(donorId), "team@example.org"),
      statement.apply(importing(donorId), "team@example.org"),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results).toContainEqual({
      status: "rejected",
      reason: expect.objectContaining({
        message: expect.stringContaining("already has a donation"),
      }),
    });
    expect(await donationsOnLine()).toHaveLength(1);
  });

  it("refuses a line imported twice in one request", async () => {
    const donorId = await donorWithStandingOrder();

    await expect(
      statement.apply(
        importing(donorId, {
          manualRecurring: [{ transaction: LINE, donorId }],
        }),
        "team@example.org",
      ),
    ).rejects.toThrow("imported twice");
    expect(await donationsOnLine()).toHaveLength(0);
  });

  it("refuses a line that's both imported and ignored", async () => {
    const donorId = await donorWithStandingOrder();

    await expect(
      statement.apply(
        importing(donorId, {
          ignore: [{ archivingCode: LINE.archivingCode }],
        }),
        "team@example.org",
      ),
    ).rejects.toThrow("both imported and ignored");
    expect(await donationsOnLine()).toHaveLength(0);
  });
});
