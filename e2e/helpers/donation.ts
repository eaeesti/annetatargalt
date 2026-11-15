import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { URLS } from "../stack/config.ts";
import { choose } from "./page.ts";

/** The donation form's buttons and fields, by the seed's texts. */
export const form = (page: Page) => ({
  single: page.getByRole("radio", { name: "Single donation text" }),
  recurring: page.getByRole("radio", { name: "Recurring donation text" }),
  amount: (euros: number) => page.getByRole("radio", { name: `${euros}€` }),
  otherAmount: page.getByRole("radio", { name: "Other amount option text" }),
  otherAmountInput: page.getByRole("textbox", { name: "Other amount text" }),
  next: page.getByRole("button", { name: "Next button text" }),
  firstName: page.getByLabel("First name text"),
  lastName: page.getByLabel("Last name text"),
  email: page.getByLabel("Email text", { exact: true }),
  idCode: page.getByLabel("Id code text"),
  company: page.getByRole("checkbox", { name: "Donate as company text" }),
  companyName: page.getByLabel("Company name text"),
  companyCode: page.getByLabel("Company code text"),
  dedicate: page.getByRole("checkbox", { name: "Dedicate donation text" }),
  dedicationName: page.getByLabel("Dedication name text"),
  dedicationEmail: page.getByLabel("Dedication email text"),
  dedicationMessage: page.getByLabel("Dedication message text"),
  tip: page.getByRole("checkbox", { name: "Tip checkbox text" }),
  card: page.getByRole("radio", { name: "Card payments text" }),
  newsletter: page.getByRole("checkbox", { name: "Newsletter text." }),
  terms: page.getByRole("checkbox", { name: "Terms text." }),
  donate: page.getByRole("button", { name: "Donate button text" }),
  summary: page.locator("dl").last(),
});

export interface Donor {
  firstName: string;
  lastName: string;
  email: string;
  idCode?: string;
}

/** Fills in the donor's step and goes on to the next. */
export async function fillDetails(page: Page, donor: Donor) {
  const f = form(page);
  await f.firstName.fill(donor.firstName);
  await f.lastName.fill(donor.lastName);
  await f.email.fill(donor.email);
  if (donor.idCode) await f.idCode.fill(donor.idCode);
}

/**
 * From the first step to the confirmation step of a one-off donation, with
 * the form's own choices of amount and organizations.
 */
export async function toConfirmation(page: Page, donor: Donor) {
  const f = form(page);
  await choose(f.single);
  await f.next.click();
  await fillDetails(page, donor);
  await f.next.click();
  await f.next.click();
  await expect(
    page.getByRole("heading", { name: "Confirm text" }),
  ).toBeVisible();
}

/** On the fake bank's page: pays, or gives up. */
export async function payAtBank(
  page: Page,
  outcome: "pay" | "abandon" = "pay",
) {
  await page.waitForURL(`${URLS.fakes}/pay/**`);
  await page
    .getByRole("button", {
      name: outcome === "pay" ? "Approve payment" : "Abandon",
    })
    .click();
}
