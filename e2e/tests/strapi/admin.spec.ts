import { expect, test } from "@playwright/test";
import { ADMINS } from "../../stack/config.ts";
import { TEXT } from "../../stack/content.ts";

test("Strapi's admin signs in and lists the pages to edit", async ({
  page,
}) => {
  test.setTimeout(90 * 1000);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Anneta Targalt's website" }),
  ).toBeVisible({ timeout: 30 * 1000 });
  await expect(page.getByText("Log in to edit annetatargalt.ee")).toBeVisible();

  await page.getByLabel("Email").fill(ADMINS.strapi.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(ADMINS.strapi.password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/auth"));

  await page.goto("/admin/content-manager/collection-types/api::page.page");
  await expect(
    page.getByRole("gridcell", { name: "Donate" }).first(),
  ).toBeVisible({
    timeout: 30 * 1000,
  });
  await page.getByRole("gridcell", { name: "Donate" }).first().click();
  await expect(page.getByText(TEXT.donateTitle).first()).toBeVisible();
});
