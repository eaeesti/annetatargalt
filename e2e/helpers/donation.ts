import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { URLS } from "../stack/config.ts";
import { CAUSES } from "../stack/content.ts";
import { choose } from "./page.ts";

/** A pattern for a name that starts with these words. */
const startingWith = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

/** The donation form's buttons and fields, by the seed's texts. */
export const form = (page: Page) => ({
  single: page.getByRole("radio", { name: "Single donation text" }),
  recurring: page.getByRole("radio", { name: "Recurring donation text" }),
  amount: (euros: number) => page.getByRole("radio", { name: `${euros}€` }),
  otherAmount: page.getByRole("radio", { name: "Other amount option text" }),
  otherAmountInput: page.getByRole("textbox", { name: "Other amount text" }),
  /**
   * A cause's box, by its title, or support for the platform's ("Support
   * option text"). Its name goes on with its share and amount.
   */
  choice: (title: string) =>
    page.locator("form").getByRole("checkbox", { name: startingWith(title) }),
  support: page
    .locator("form")
    .getByRole("checkbox", { name: startingWith("Support option text") }),
  /** The way to a cause's charities, while it's the fund alone. */
  specify: (cause: string) =>
    page.getByRole("button", { name: `Specify charities text: ${cause}` }),
  /** The way back to them, once charities are chosen. */
  editCharities: (cause: string) =>
    page.getByRole("button", { name: `Edit charities text: ${cause}` }),
  /** On to the details: "Next button text". */
  next: page.getByRole("button", { name: "Next button text" }),
  resetSplit: page.getByRole("button", { name: "Reset split text" }),
  splitEvenly: page.getByRole("button", { name: "Split evenly text" }),
  /** The split bar's handles, from the left. */
  borders: page.getByRole("slider"),
  editDonation: page.getByRole("button", { name: "Edit donation text" }),
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
  card: page.getByRole("radio", { name: "Card payments text" }),
  otherBank: page.getByRole("radio", { name: "Other bank text" }),
  newsletter: page.getByRole("checkbox", { name: "Newsletter text." }),
  terms: page.getByRole("checkbox", { name: "Terms text." }),
  donate: page.getByRole("button", { name: "Donate button text" }),
  /** The donation beside the form, on wide screens: its lines and total. */
  summary: page.getByRole("complementary", { name: "Overview title" }),
});

/** A cause's or support's share, as its box shows it: "50%". */
export async function shareOf(page: Page, title: string) {
  const box = form(page).choice(title);
  const id = await box.getAttribute("id");
  return (
    await page.locator(`label[for="${id}"] span`).first().innerText()
  ).replace(/\s/g, "");
}

export interface Donor {
  firstName: string;
  lastName: string;
  email: string;
  idCode?: string;
}

/** Fills in the donor's details. */
export async function fillDetails(page: Page, donor: Donor) {
  const f = form(page);
  await f.firstName.fill(donor.firstName);
  await f.lastName.fill(donor.lastName);
  await f.email.fill(donor.email);
  if (donor.idCode) await f.idCode.fill(donor.idCode);
}

/**
 * From the first step of a one-off donation of the form's amount to paying
 * for it, with the donor's details filled in: the causes ticked (both, split
 * evenly, unless said), each going to its fund.
 */
export async function toPayment(
  page: Page,
  donor: Donor,
  causes: string[] = [CAUSES.health.title, CAUSES.climate.title],
) {
  const f = form(page);
  await choose(f.single);
  for (const cause of causes) await choose(f.choice(cause));
  await f.next.click();
  await fillDetails(page, donor);
  await expect(f.donate).toBeVisible();
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
