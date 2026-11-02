/**
 * Integration tests for the bank-statement import's preview: which donor a
 * payment is matched to. It isn't a repository, but it needs the test
 * database, which only the tests in this folder get.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Core } from "@strapi/strapi";
import { createStatementService } from "../../../plugins/admin-panel/server/services/statement";
import {
  cleanDatabase,
  createTestDonor,
  createTestRecurringDonation,
  createTestOrganizationRecurringDonation,
} from "../../__tests__/test-db-helper";

// The preview reads Strapi only for organizations' names.
const statement = createStatementService(
  // oxlint-disable-next-line typescript/consistent-type-assertions
  {
    documents: () => ({
      findFirst: async () => null,
      findMany: async () => [],
    }),
  } as unknown as Core.Strapi,
);

const COMPANY = "10000000";

/** A statement with one payment of €20 from the company's account. */
const CSV = `﻿"Kliendi konto","Kuupäev","Saaja/maksja konto","Saaja/maksja nimi","Deebet/Kreedit (D/C)","Summa","Arhiveerimistunnus","Selgitus","Valuuta","Isikukood või registrikood","Kande viide"
"EE24","2026-10-05","EE000000000000000001","AAA BBB OÜ","C",20.00,"2026100500000001","Annetus","EUR","${COMPANY}","900000001"
`;

/** A donor with a standing order for €20 that names the company. */
async function donorNamingTheCompany(idCode: string) {
  const donor = await createTestDonor({
    idCode,
    email: `${idCode}@example.org`,
  });
  const template = await createTestRecurringDonation({
    donorId: donor.id,
    amount: 2000,
    companyName: "AAA BBB OÜ",
    companyCode: COMPANY,
    datetime: new Date("2026-09-01T10:00:00Z"),
  });
  await createTestOrganizationRecurringDonation({
    recurringDonationId: template.id,
    organizationInternalId: "test-org",
    amount: 2000,
  });
  return donor;
}

describe("statement preview", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("matches a company's payment to the one donor who named the company", async () => {
    const donor = await donorNamingTheCompany("38207162722");

    const report = await statement.preview(CSV);

    expect(report.recurringImports).toHaveLength(1);
    expect(report.recurringImports[0]?.donorId).toBe(donor.id);
  });

  it("leaves a company named by two donors for the team to place", async () => {
    await donorNamingTheCompany("38207162722");
    await donorNamingTheCompany("49403136526");

    const report = await statement.preview(CSV);

    expect(report.recurringImports).toHaveLength(0);
    expect(report.needsDecision).toHaveLength(1);
    expect(report.needsDecision[0]?.reason).toMatch(/2 donors give this code/);
  });
});
