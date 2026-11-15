import { defineConfig, devices } from "@playwright/test";
import { URLS } from "./stack/config.ts";

const CI = Boolean(process.env.CI);
// Building the backend and both sites takes a few minutes.
const BUILD_TIMEOUT = 10 * 60 * 1000;

export default defineConfig({
  testDir: "tests",
  outputDir: ".state/test-results",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 3,
  timeout: 45 * 1000,
  expect: { timeout: 10 * 1000 },
  reporter: CI
    ? [["github"], ["html", { outputFolder: ".state/report", open: "never" }]]
    : [["list"], ["html", { outputFolder: ".state/report", open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "et-EE",
    timezoneId: "Europe/Tallinn",
  },
  projects: [
    {
      name: "site",
      testDir: "tests/site",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: URLS.site },
    },
    {
      name: "site-mobile",
      testDir: "tests/site",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"], baseURL: URLS.site },
    },
    {
      name: "admin-login",
      testDir: "tests/admin",
      testMatch: /sign-in\.setup\.ts/,
      use: { baseURL: URLS.admin },
    },
    {
      name: "admin",
      testDir: "tests/admin",
      dependencies: ["admin-login"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: URLS.admin,
        storageState: ".state/admin-session.json",
      },
    },
    {
      name: "strapi",
      testDir: "tests/strapi",
      use: { ...devices["Desktop Chrome"], baseURL: URLS.backend },
    },
  ],
  // In this order: the backend needs the fakes' certificate, and the site's
  // build reads the backend's content.
  webServer: [
    {
      command: "node stack/fakes.ts",
      url: `${URLS.fakes}/health`,
      reuseExistingServer: !CI,
    },
    {
      command: "node stack/backend.mjs",
      url: `${URLS.backend}/_health`,
      timeout: BUILD_TIMEOUT,
      reuseExistingServer: !CI,
    },
    {
      command: "node stack/app.mjs site",
      url: URLS.site,
      timeout: BUILD_TIMEOUT,
      reuseExistingServer: !CI,
    },
    {
      command: "node stack/app.mjs admin",
      url: `${URLS.admin}/login`,
      timeout: BUILD_TIMEOUT,
      reuseExistingServer: !CI,
    },
  ],
});
