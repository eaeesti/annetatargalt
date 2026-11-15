import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { donate } from "../../helpers/api.ts";
import { uniqueEmail } from "../../helpers/fakes.ts";
import { ORGS } from "../../stack/content.ts";

test("a paid donation shows in the list, with its donor and split", async ({
  page,
}) => {
  const email = uniqueEmail();
  const id = await donate({
    firstName: "Liisa",
    lastName: "Loendur",
    email,
    amount: 35,
  });

  await page.goto("/donations");
  const row = page.getByRole("row", { name: new RegExp(`#${id} `) });
  await expect(row).toContainText("€35.00");
  await expect(row).toContainText("Liisa Loendur");
  await expect(row).toContainText("Finalized");

  await row.getByRole("link", { name: `#${id}` }).click();
  await expect(
    page.getByRole("heading", { name: `Donation #${id}` }),
  ).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(
    page.getByRole("link", { name: ORGS.alpha.title }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Liisa Loendur" }).click();
  await expect(
    page.getByRole("heading", { name: "Liisa Loendur" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Total donated€35.00");
});

test("an admin turns a donor's newsletter off", async ({ page }) => {
  const email = uniqueEmail();
  const id = await donate({
    firstName: "Uudo",
    lastName: "Uudis",
    email,
    amount: 5,
  });
  await page.goto(`/donations/${id}`);
  await page.getByRole("link", { name: "Uudo Uudis" }).click();

  const newsletter = page.getByRole("checkbox", { name: "Newsletter" });
  await expect(newsletter).toBeChecked();
  await newsletter.uncheck();
  await expect(page.getByText("Last changed")).toBeVisible();
  await page.reload();
  await expect(newsletter).not.toBeChecked();
});

/** The "Total donated" card's sum in cents and its count of donations. */
async function totalDonated(page: Page) {
  await page.goto("/");
  const card = page
    .getByText("Total donated", { exact: true })
    .locator("xpath=..");
  const paragraphs = card.locator("p");
  const sum = await paragraphs.nth(1).innerText();
  const count = await paragraphs.nth(2).innerText();
  return {
    cents: Number(sum.replace(/[^\d,]/g, "").replace(",", "")),
    count: Number(count.replace(/\D/g, "")),
  };
}

test("the dashboard counts donations", async ({ page }) => {
  const before = await totalDonated(page);
  await donate({
    firstName: "Dash",
    lastName: "Board",
    email: uniqueEmail(),
    amount: 12,
  });
  // Other tests give at the same time, so at least this one is added.
  const after = await totalDonated(page);
  expect(after.count).toBeGreaterThanOrEqual(before.count + 1);
  expect(after.cents).toBeGreaterThanOrEqual(before.cents + 1200);
});

test("a monthly donation shows among the recurring ones", async ({ page }) => {
  const email = uniqueEmail();
  // Its own name: the list shows names, and a retry adds another.
  const lastName = `Kuukiri-${email.slice(6, 10)}`;
  await donate({
    firstName: "Kuno",
    lastName,
    email,
    amount: 15,
    type: "recurring",
    bank: "other",
  });
  await page.goto("/recurring-donations");
  const row = page.getByRole("row").filter({ hasText: `Kuno ${lastName}` });
  await expect(row).toContainText("€15.00");
  await row.getByRole("link").first().click();
  await expect(page.getByText(email)).toBeVisible();
});

test("organizations show what they were given", async ({ page }) => {
  const id = await donate(
    { firstName: "Gert", lastName: "Gamma", email: uniqueEmail(), amount: 7 },
    "gamma",
  );
  await page.goto("/organizations");
  const row = page.getByRole("row").filter({ hasText: ORGS.gamma.title });
  await expect(row).toContainText(/€\d/);
  await row.getByRole("link", { name: ORGS.gamma.title }).click();
  await expect(
    page.getByRole("heading", { name: ORGS.gamma.title }),
  ).toBeVisible();
  // This donation, with its amount, among the organization's.
  await expect(
    page.getByRole("link", { name: new RegExp(`^#${id} .*€7\\.00$`) }),
  ).toBeVisible();
});

test("the donations list exports as CSV", async ({ page }) => {
  await donate({
    firstName: "Ekspo",
    lastName: "Rt",
    email: uniqueEmail(),
    amount: 9,
  });
  await page.goto("/donations");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  const csv = await readFile(await file.path(), "utf8");
  expect(csv.split("\n")[0]).toMatch(/amount/i);
  expect(csv).toContain("Ekspo");
});
