import { expect, test } from "@playwright/test";
import { choose, clickToOpen } from "../../helpers/page.ts";
import { CAUSES, TEXT } from "../../stack/content.ts";

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

test("on a phone the details step has the donation in a bar, and Donate says the total", async ({
  page,
}) => {
  await page.goto("/anneta");
  await choose(
    page
      .locator("form")
      .getByRole("checkbox", { name: new RegExp(`^${CAUSES.health.title}`) }),
  );
  await page.getByRole("button", { name: "Next button text" }).click();

  // Closed, the bar shows the total; opened, the donation's lines.
  const bar = page.getByRole("button", { name: /^Overview title.*30,00€/ });
  await expect(bar).toHaveAttribute("aria-expanded", "false");
  await clickToOpen(bar, page.getByText("Example Fund"));
  await expect(
    page.getByRole("button", { name: "Donate button text 30,00€" }),
  ).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});
