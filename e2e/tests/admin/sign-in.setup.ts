import { existsSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { ADMINS } from "../../stack/config.ts";

const SESSION = ".state/admin-session.json";

// Signs in once; the admin panel's tests share this session. A session from
// an earlier run is kept while it works: Strapi lets an address sign in only
// a few times in a few minutes, and runs against the same stack follow each
// other quickly.
setup("sign in to the admin panel", async ({ browser }) => {
  if (existsSync(SESSION)) {
    const context = await browser.newContext({ storageState: SESSION });
    const page = await context.newPage();
    await page.goto("/");
    const signedIn = await page
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    await context.close();
    if (signedIn) return;
  }

  const page = await browser.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMINS.shared.email);
  await page.getByLabel("Password").fill(ADMINS.shared.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.context().storageState({ path: SESSION });
  await page.close();
});
