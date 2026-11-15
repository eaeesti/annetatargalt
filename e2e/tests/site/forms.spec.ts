import { expect, test } from "@playwright/test";
import { payAtBank } from "../../helpers/donation.ts";
import { orderOnPage, uniqueEmail, waitForEmail } from "../../helpers/fakes.ts";
import { TEAM_EMAIL } from "../../stack/config.ts";
import { TEXT } from "../../stack/content.ts";
import { choose } from "../../helpers/page.ts";

test("the contact form's message reaches the team", async ({ page }) => {
  const visitor = uniqueEmail("visitor");
  const message = `Hello from ${visitor}`;
  await page.goto("/kontakt");
  const send = page.getByRole("button", { name: "Send label" });
  await expect(send).toBeDisabled();
  await page.getByLabel("Name label").fill("Küsija Kask");
  await page.getByLabel("Email label").fill(visitor);
  await page.getByLabel("Message label").fill(message);
  await send.click();
  await expect(page.getByText(TEXT.contactSuccess)).toBeVisible();

  const email = await waitForEmail(
    TEAM_EMAIL,
    `${TEXT.contactSubject}: Küsija Kask`,
    message,
  );
  expect(email.text).toContain(message);
  expect(email.text).toContain(visitor);
});

test("a donation from abroad is paid by card", async ({ page }) => {
  const email = uniqueEmail("abroad");
  await page.goto("/annetus-valismaalt");
  await choose(page.getByRole("radio", { name: "20€" }));
  await page.getByLabel("First name text").fill("Fred");
  await page.getByLabel("Last name text").fill("Foreign");
  await page.getByLabel("Email text").fill(email);
  const donate = page.getByRole("button", { name: "Donate button text" });
  await expect(donate).toBeDisabled();
  await page.getByRole("checkbox", { name: "I agree with the terms." }).check();
  await donate.click();

  await page.waitForURL("**/pay/**");
  const order = await orderOnPage(page.url());
  expect(order?.method).toBe("cardPayments");
  expect(order?.grandTotal).toBe(20);
  await payAtBank(page);
  await expect(
    page.getByRole("heading", { name: /Thank you, Fred/ }),
  ).toBeVisible();
  await waitForEmail(email, TEXT.confirmationSubject);
});

test("the income calculator compares an income with the world's", async ({
  page,
}) => {
  await page.goto("/kui-rikas-sa-oled");
  const calculate = page.getByRole("button", { name: "Calculate button text" });
  await expect(calculate).toBeDisabled();
  await page.getByRole("button", { name: "Rohkem lapsi" }).click();
  await page.getByLabel("Income label").fill("2000");
  await calculate.click();
  await expect(page.getByText(/Your income is/)).toBeVisible();
});
