import { expect, test } from "@playwright/test";
import { donate } from "../../helpers/api.ts";
import { uniqueEmail, waitForEmail } from "../../helpers/fakes.ts";
import { ADMINS } from "../../stack/config.ts";

test("a newsletter goes to the donors chosen", async ({ page }) => {
  const email = uniqueEmail("reader");
  await donate({ firstName: "Lugeja", lastName: "Leht", email, amount: 5 });
  const subject = `E2E newsletter ${Date.now()}`;

  await page.goto("/emails");
  await page.getByRole("button", { name: "New email" }).click();
  await page.waitForURL(/\/emails\/\d+$/);
  await page.getByRole("textbox", { name: "Name" }).fill(subject);
  await page.getByLabel(/^Only these addresses/).fill(email);
  await page.getByRole("textbox", { name: "Estonian subject" }).fill(subject);
  await page
    .getByRole("textbox", { name: "English subject" })
    .fill(`${subject} (en)`);
  await page
    .getByRole("textbox", { name: "Block 1, Estonian" })
    .fill("Tere, {{firstName}}! Uudised.");
  await page
    .getByRole("textbox", { name: "Block 1, English" })
    .fill("Hello, {{firstName}}! News.");

  await page.getByRole("button", { name: "Send a test to me" }).click();
  const testEmail = await waitForEmail(ADMINS.shared.email, subject);
  expect(testEmail.text).toContain("Uudised.");

  await page.getByRole("button", { name: "Send to 1 donor" }).click();
  await page.getByRole("button", { name: "Send", exact: true }).click();

  const sent = await waitForEmail(email, subject);
  expect(sent.text).toContain("Tere, Lugeja! Uudised.");
  // Every newsletter carries a way out.
  expect(sent.text).toMatch(/email-settings/);
});
