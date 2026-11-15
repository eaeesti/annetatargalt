import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { donate, idCode } from "../../helpers/api.ts";
import { uniqueEmail } from "../../helpers/fakes.ts";
import { DONATION_INFO } from "../../stack/content.ts";

// Both change what counts as transferred and reconciled, which the other's
// lists would show: one at a time.
test.describe.configure({ mode: "serial" });

/** Today in this machine's time zone, as the bank and the admin panel see it. */
const today = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** An LHV statement, as its Estonian export writes it. */
function statement(lines: string[][]) {
  const header = [
    "Kliendi konto",
    "Kuupäev",
    "Saaja/maksja konto",
    "Saaja/maksja nimi",
    "Deebet/Kreedit (D/C)",
    "Summa",
    "Arhiveerimistunnus",
    "Selgitus",
    "Valuuta",
    "Isikukood või registrikood",
    "Kande viide",
  ];
  const row = (cells: string[]) => cells.map((c) => `"${c}"`).join(",");
  return `﻿${[header, ...lines].map(row).join("\n")}\n`;
}

test("a bank statement reconciles a bank transfer and records a standing order", async ({
  page,
}, testInfo) => {
  // Unique codes for this run: the bank rows' keys are the archiving codes.
  const code = Date.now().toString().slice(-8);
  const riho = idCode();
  const ott = idCode();
  await donate({
    firstName: "Riho",
    lastName: `Regulaar${code}`,
    email: uniqueEmail(),
    idCode: riho,
    amount: 10,
    type: "recurring",
    bank: "other",
  });
  const oneOff = await donate({
    firstName: "Ott",
    lastName: `Ost${code}`,
    email: uniqueEmail(),
    idCode: ott,
    amount: 25,
  });

  const file = testInfo.outputPath("statement.csv");
  await writeFile(
    file,
    statement([
      [
        DONATION_INFO.iban,
        today(),
        "EE111000001234567890",
        `RIHO REGULAAR${code}`,
        "C",
        "10.00",
        `A${code}1`,
        DONATION_INFO.recurringPaymentComment,
        "EUR",
        riho,
        `${code}1`,
      ],
      [
        DONATION_INFO.iban,
        today(),
        "EE382200221020145685",
        `OTT OST${code}`,
        "C",
        "25.00",
        `A${code}2`,
        "Annetus",
        "EUR",
        ott,
        `${code}2`,
      ],
      [
        DONATION_INFO.iban,
        today(),
        "EE999000001111111111",
        "SOMEONE ELSE",
        "D",
        "-3.00",
        `A${code}3`,
        "Bank fee",
        "EUR",
        "",
        `${code}3`,
      ],
    ]),
  );

  await page.goto("/statement");
  await page.locator("input[type=file]").setInputFiles(file);
  await page.getByRole("button", { name: "Analyse" }).click();

  const transfers = page
    .getByRole("table")
    .filter({ hasText: `Ott Ost${code}` });
  await expect(
    transfers.getByRole("row", { name: new RegExp(`#${oneOff} `) }),
  ).toBeVisible();
  await expect(page.getByText("1 outgoing (debit) lines")).toBeVisible();

  await page.getByRole("button", { name: /^Apply \d+ changes?$/ }).click();
  await expect(page.getByText(/^Applied:/)).toHaveText(
    /Applied: 1 donations created, 1 reconciled, 0 ignored, 3 bank rows recorded/,
  );

  // The bank transfer now has its transaction ID.
  await page.goto(`/donations/${oneOff}`);
  await expect(page.getByText(`A${code}2`)).toBeVisible();

  // The standing order's payment is a donation of the recurring donor's.
  await page.goto("/recurring-donations");
  const recurring = page
    .getByRole("row")
    .filter({ hasText: `Riho Regulaar${code}` });
  await expect(recurring).toContainText("€10.00");
  await recurring.click();
  await expect(
    page.getByRole("link", { name: /Finalized.*€10\.00/ }),
  ).toBeVisible();

  await page.goto("/transactions");
  await expect(
    page.getByRole("row").filter({ hasText: `OTT OST${code}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: `RIHO REGULAAR${code}` }),
  ).toBeVisible();
});

test("a transfer round takes in the donations of a period", async ({
  page,
}) => {
  const id = await donate({
    firstName: "Tõnis",
    lastName: "Ülekanne",
    email: uniqueEmail(),
    amount: 44,
  });
  await page.goto("/transfers/new");
  await page.getByLabel("From", { exact: true }).fill(today());
  await page.getByRole("button", { name: "Load donations" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Tõnis Ülekanne" }),
  ).toBeVisible();
  await page.getByLabel("Notes (optional)").fill("E2E round");
  await page.getByRole("button", { name: /^Create transfer/ }).click();

  await page.waitForURL(/\/transfers\/\d+$/);
  const transferId = new URL(page.url()).pathname.split("/").pop();
  await expect(page.getByText("E2E round")).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(`#${id} `) }),
  ).toBeVisible();

  // The donation now belongs to the round.
  await page.goto(`/donations/${id}`);
  await expect(
    page.getByRole("link", { name: `#${transferId}`, exact: true }),
  ).toBeVisible();
});
