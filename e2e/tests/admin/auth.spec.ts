import { expect, test } from "@playwright/test";
import { uniqueEmail } from "../../helpers/fakes.ts";
import { ADMINS } from "../../stack/config.ts";

// Without the shared session: these sign in and out themselves. Strapi lets
// an address sign in only a few times in a few minutes, counting successful
// sign-ins too, so running this file over and over against a stack that's
// kept up (pnpm test:ui) soon meets that limit; a new stack starts afresh.
test.use({ storageState: { cookies: [], origins: [] } });

test("a visitor who isn't signed in is sent to sign in", async ({ page }) => {
  await page.goto("/donations");
  await page.waitForURL("**/login**");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  // A new address no admin has, so no earlier attempts count against it.
  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid credentials")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("an admin signs in and out", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMINS.signIn.email);
  await page.getByLabel("Password").fill(ADMINS.signIn.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(ADMINS.signIn.email)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login**");
  await page.goto("/donations");
  await page.waitForURL("**/login**");
});
