import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { form, payAtBank, toConfirmation } from "../../helpers/donation.ts";
import { uniqueEmail, waitForEmail } from "../../helpers/fakes.ts";
import { TEXT } from "../../stack/content.ts";

/** Donates, and returns the email settings link from the confirmation. */
async function settingsLink(page: Page, email: string) {
  await page.goto("/anneta");
  await toConfirmation(page, { firstName: "Eha", lastName: "Eelistus", email });
  await form(page).terms.check();
  await form(page).donate.click();
  await payAtBank(page);
  const confirmation = await waitForEmail(email, TEXT.confirmationSubject);
  const link = confirmation.text.match(/http\S+email-settings\S+/)?.[0];
  if (!link) throw new Error("No email settings link in the confirmation");
  return link;
}

test("a donor turns emails off from the link in their email", async ({
  page,
}) => {
  const email = uniqueEmail();
  const link = await settingsLink(page, email);

  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: TEXT.preferencesTitle }),
  ).toBeVisible();
  await expect(page.getByText(`Settings for ${email}.`)).toBeVisible();
  const newsletter = page.getByRole("checkbox", { name: /Newsletter label/ });
  await expect(newsletter).toBeChecked();
  await newsletter.uncheck();
  await page.getByRole("radio", { name: "English" }).check();
  await page.getByRole("button", { name: "Save text" }).click();
  await expect(page.getByText("Saved text")).toBeVisible();

  await page.goto(link);
  await expect(newsletter).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Yearly emails label/ }),
  ).toBeChecked();
  await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
});

test("a broken link says so", async ({ page }) => {
  await page.goto("/teavitused#token=1.not-a-real-token");
  await expect(page.getByText("Invalid link title")).toBeVisible();
});
