import { expect, test } from "@playwright/test";
import { clickToOpen } from "../../helpers/page.ts";
import { TEXT } from "../../stack/content.ts";

test("the menu opens on a phone and leads to a page", async ({ page }) => {
  await page.goto("/");
  const faq = page.getByRole("dialog").getByRole("link", { name: "KKK" });
  await clickToOpen(page.getByRole("button", { name: "Ava menüü" }), faq);
  await faq.click();
  await expect(
    page.getByRole("heading", { name: TEXT.faqTitle }),
  ).toBeVisible();
});

test("the donation form fits a phone", async ({ page }) => {
  await page.goto("/anneta");
  await expect(
    page.getByRole("button", { name: "Next button text" }),
  ).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});
