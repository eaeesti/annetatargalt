import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { clickToOpen } from "../../helpers/page.ts";
import { CAUSES, ORGS, TEXT } from "../../stack/content.ts";

/** Fails the test on any error the page logs or throws. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test.describe("every page", () => {
  const pages: [string, string][] = [
    ["/", TEXT.heroTitle],
    ["/anneta", TEXT.donateTitle],
    ["/kontakt", TEXT.contactTitle],
    ["/kkk", TEXT.faqTitle],
    ["/kuhu-annetada", TEXT.whereTitle],
    [`/${CAUSES.health.slug}`, CAUSES.health.title],
    [`/${CAUSES.health.slug}/${ORGS.alpha.slug}`, ORGS.alpha.title],
    ["/blogi", TEXT.blogTitle],
    ["/blogi/first-post", TEXT.blogPostTitle],
    ["/kui-rikas-sa-oled", TEXT.calculatorTitle],
    ["/annetus-valismaalt", TEXT.foreignTitle],
    ["/tekst", "Text page"],
    ["/en", TEXT.enHeroTitle],
    ["/en/donate", TEXT.enDonateTitle],
    [`/en/${CAUSES.climate.enSlug}`, CAUSES.climate.enTitle],
  ];

  for (const [path, heading] of pages) {
    test(`${path} shows its content, without errors`, async ({ page }) => {
      const errors = watchErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: heading }).first(),
      ).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });
  }
});

test("the page title and description come from the page's metadata", async ({
  page,
}) => {
  await page.goto("/kkk");
  await expect(page).toHaveTitle(/FAQ/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "FAQ page",
  );
});

test("an address that isn't a page answers 404 with the not-found page", async ({
  page,
}) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: TEXT.notFoundTitle }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to the front page" }).click();
  await expect(
    page.getByRole("heading", { name: TEXT.heroTitle }),
  ).toBeVisible();
});

test("a redirect page sends the visitor on", async ({ page }) => {
  await page.goto("/vana-leht");
  await page.waitForURL("**/kkk");
  await expect(
    page.getByRole("heading", { name: TEXT.faqTitle }),
  ).toBeVisible();
});

test("the navigation bar and footer lead to their pages", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation").first();
  await nav.getByRole("link", { name: "KKK" }).click();
  await expect(
    page.getByRole("heading", { name: TEXT.faqTitle }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Anneta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: TEXT.donateTitle }),
  ).toBeVisible();
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Contact" })
    .click();
  await expect(
    page.getByRole("heading", { name: TEXT.contactTitle }),
  ).toBeVisible();
  await page.getByRole("link", { name: TEXT.siteTitle }).click();
  await expect(
    page.getByRole("heading", { name: TEXT.heroTitle }),
  ).toBeVisible();
});

test("the front page's button leads to the donation form", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Donate now" }).click();
  await expect(
    page.getByRole("heading", { name: TEXT.donateTitle }),
  ).toBeVisible();
});

test("a question opens to its answer", async ({ page }) => {
  await page.goto("/kkk");
  const answer = page.getByText(TEXT.faqAnswer);
  await expect(answer).toBeHidden();
  await clickToOpen(
    page.getByRole("button", { name: TEXT.faqQuestion }),
    answer,
  );
});

test("text pages render their markdown", async ({ page }) => {
  await page.goto("/tekst");
  await expect(page.getByRole("heading", { name: "Text page" })).toBeVisible();
  await expect(page.getByText(TEXT.textPageText)).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "two" }),
  ).toBeVisible();
});

test("the blog lists its posts", async ({ page }) => {
  await page.goto("/blogi");
  // A post's card is a link named after the post, for screen readers too.
  await page.getByRole("link", { name: TEXT.blogPostTitle }).click();
  await page.waitForURL("**/blogi/first-post");
  await expect(
    page.getByRole("heading", { name: TEXT.blogPostTitle }),
  ).toBeVisible();
  await expect(page.getByText("The first post's body.")).toBeVisible();
});

test.describe("causes and organizations", () => {
  test("lead from the list to an organization and its donation form", async ({
    page,
  }) => {
    await page.goto("/kuhu-annetada");
    await page
      .getByRole("link", { name: "Read about organizations text" })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/${CAUSES.health.slug}$`));
    await expect(
      page.getByText(`${CAUSES.health.title} content.`),
    ).toBeVisible();

    await page.getByRole("heading", { name: ORGS.alpha.title }).click();
    await expect(
      page.getByRole("heading", { name: ORGS.alpha.title }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(`${ORGS.alpha.title} does good work.`),
    ).toBeVisible();

    await page
      .getByRole("link", { name: `Donate to ${ORGS.alpha.title}` })
      .click();
    await expect(
      page.getByRole("heading", { name: TEXT.donateTitle }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`org=${ORGS.alpha.internalId}`));
    await expect(
      page.getByRole("slider", { name: CAUSES.health.title }),
    ).toHaveValue("100");
  });

  test("an organization outside its cause's address isn't found", async ({
    page,
  }) => {
    const response = await page.goto(`/${CAUSES.health.slug}/no-such-org`);
    expect(response?.status()).toBe(404);
  });
});

test.describe("languages", () => {
  test("the language menu leads to the same page in English and back", async ({
    page,
  }) => {
    await page.goto("/anneta");
    const english = page.getByRole("menuitem", { name: "English" });
    await clickToOpen(
      page.getByRole("button", { name: "Keel: Eesti" }).first(),
      english,
    );
    await english.click();
    await page.waitForURL("**/en/donate");
    await expect(
      page.getByRole("heading", { name: TEXT.enDonateTitle }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const eesti = page.getByRole("menuitem", { name: "Eesti" });
    await clickToOpen(
      page.getByRole("button", { name: /English/ }).first(),
      eesti,
    );
    await eesti.click();
    await page.waitForURL((url) => url.pathname === "/anneta");
  });

  test("a page with no English version leads to the English front page", async ({
    page,
  }) => {
    await page.goto("/kkk");
    const english = page.getByRole("menuitem", { name: "English" });
    await clickToOpen(
      page.getByRole("button", { name: "Keel: Eesti" }).first(),
      english,
    );
    await english.click();
    await page.waitForURL((url) => url.pathname === "/en");
    await expect(
      page.getByRole("heading", { name: TEXT.enHeroTitle }),
    ).toBeVisible();
  });

  test("pages name their translations for search engines", async ({ page }) => {
    await page.goto("/anneta");
    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveAttribute("href", /\/en\/donate$/);
  });
});

test("the sitemap lists the pages and robots.txt points to it", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/kkk</loc>");
  expect(sitemap).toContain(`/${CAUSES.health.slug}/${ORGS.alpha.slug}</loc>`);
  expect(sitemap).toContain("/en/donate</loc>");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("sitemap.xml");
});
