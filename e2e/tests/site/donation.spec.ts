import { expect, test } from "@playwright/test";
import {
  form,
  fillDetails,
  payAtBank,
  toConfirmation,
} from "../../helpers/donation.ts";
import {
  emailsTo,
  orderOnPage,
  uniqueEmail,
  waitForEmail,
} from "../../helpers/fakes.ts";
import { DONATION_INFO, ORGS, TEXT } from "../../stack/content.ts";
import { choose } from "../../helpers/page.ts";

test.describe("one-off donation", () => {
  test("is paid at the bank, thanked for and confirmed by email", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await page.goto("/anneta");
    await expect(
      page.getByRole("heading", { name: TEXT.donateTitle }),
    ).toBeVisible();

    await toConfirmation(page, {
      firstName: "Mari",
      lastName: "Maasikas",
      email,
    });
    const f = form(page);
    // Split evenly between the two causes' funds, as the form starts out.
    await expect(f.summary).toContainText(ORGS.fund.title);
    await expect(f.summary).toContainText(ORGS.climateFund.title);
    await expect(f.summary).toContainText("30,00€");

    await expect(f.donate).toBeDisabled();
    await f.terms.check();
    await f.donate.click();

    await expect(page.getByTestId("amount")).toHaveText("30.00 EUR");
    await payAtBank(page);

    await page.waitForURL("**/aitah?order-token=*");
    await expect(
      page.getByRole("heading", { name: "Thank you, Mari!" }),
    ).toBeVisible();
    await expect(page.getByText("You gave 30.")).toBeVisible();

    const confirmation = await waitForEmail(email, TEXT.confirmationSubject);
    expect(confirmation.text).toContain("Dear Mari, you gave 30 €.");
    expect(confirmation.text).toContain(`${ORGS.fund.title}: 15€`);
    expect(confirmation.text).toContain(`${ORGS.climateFund.title}: 15€`);
    expect(confirmation.text).toMatch(/api\/email-settings\?locale=et#token=/);
  });

  test("with another amount and the platform tip", async ({ page }) => {
    const email = uniqueEmail();
    await page.goto("/anneta");
    const f = form(page);
    await choose(f.single);
    await choose(f.otherAmount);
    await f.otherAmountInput.fill("40");
    await f.next.click();
    await fillDetails(page, { firstName: "Tõnu", lastName: "Tipp", email });
    await f.next.click();
    await f.tip.check();
    await f.next.click();

    // 5% on top, to the platform
    await expect(f.summary).toContainText(ORGS.tip.title);
    await expect(f.summary).toContainText("42,00€");
    await f.terms.check();
    await f.donate.click();
    await expect(page.getByTestId("amount")).toHaveText("42.00 EUR");
    await payAtBank(page);
    await expect(
      page.getByRole("heading", { name: /Thank you, Tõnu/ }),
    ).toBeVisible();

    const confirmation = await waitForEmail(email, TEXT.confirmationSubject);
    expect(confirmation.text).toContain(`${ORGS.tip.title}: 2€`);
  });

  test("by card", async ({ page }) => {
    await page.goto("/anneta");
    await toConfirmation(page, {
      firstName: "Kaarel",
      lastName: "Kaart",
      email: uniqueEmail(),
    });
    const f = form(page);
    await f.card.check();
    await f.terms.check();
    await f.donate.click();
    await page.waitForURL("**/pay/**");
    const order = await orderOnPage(page.url());
    expect(order?.method).toBe("cardPayments");
    await payAtBank(page);
    await expect(
      page.getByRole("heading", { name: /Thank you, Kaarel/ }),
    ).toBeVisible();
  });

  test("in someone's name emails them too", async ({ page }) => {
    const donor = uniqueEmail();
    const friend = uniqueEmail("friend");
    await page.goto("/anneta");
    const f = form(page);
    await choose(f.single);
    await f.next.click();
    await fillDetails(page, {
      firstName: "Anu",
      lastName: "Andja",
      email: donor,
    });
    await f.dedicate.check();
    await f.dedicationName.fill("Sõber");
    await f.dedicationEmail.fill(friend);
    await f.dedicationMessage.fill("Palju õnne!");
    await f.next.click();
    await f.next.click();
    await f.terms.check();
    await f.donate.click();
    await payAtBank(page);
    await expect(
      page.getByRole("heading", { name: /Thank you, Anu/ }),
    ).toBeVisible();

    await waitForEmail(donor, TEXT.confirmationSubject);
    await waitForEmail(friend, TEXT.dedicationSubject);
  });

  test("as a company", async ({ page }) => {
    await page.goto("/anneta");
    const f = form(page);
    await choose(f.single);
    await f.next.click();
    await fillDetails(page, {
      firstName: "Fiona",
      lastName: "Firma",
      email: uniqueEmail(),
    });
    await f.company.check();
    await expect(f.next).toBeDisabled();
    await f.companyName.fill("Näide OÜ");
    await f.companyCode.fill("12345678");
    await expect(f.next).toBeEnabled();
    await f.next.click();
    await f.next.click();
    await f.terms.check();
    await f.donate.click();
    await payAtBank(page);
    await expect(
      page.getByRole("heading", { name: /Thank you, Fiona/ }),
    ).toBeVisible();
  });

  test("left unpaid at the bank isn't thanked for or confirmed", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await page.goto("/anneta");
    await toConfirmation(page, {
      firstName: "Pille",
      lastName: "Poolik",
      email,
    });
    const f = form(page);
    await f.terms.check();
    await f.donate.click();
    await payAtBank(page, "abandon");

    // The thank-you page sends a donation it can't confirm to the front page.
    await page.waitForURL((url) => url.pathname === "/");
    await expect(
      page.getByRole("heading", { name: TEXT.heroTitle }),
    ).toBeVisible();
    // The confirmation goes out with the notification, before the redirect.
    expect(await emailsTo(email)).toHaveLength(0);
  });
});

test.describe("the form", () => {
  test("won't go on without a valid email or ID code", async ({ page }) => {
    await page.goto("/anneta");
    const f = form(page);
    await choose(f.single);
    await f.next.click();
    await fillDetails(page, {
      firstName: "Vale",
      lastName: "Vorm",
      email: "not-an-email",
    });
    await expect(f.next).toBeDisabled();
    await f.email.fill(uniqueEmail());
    await expect(f.next).toBeEnabled();

    // An Estonian ID code has a check digit.
    await f.idCode.fill("37605030298");
    await expect(f.next).toBeDisabled();
    await f.idCode.fill("37605030299");
    await expect(f.next).toBeEnabled();
  });

  test("won't take zero as another amount", async ({ page }) => {
    await page.goto("/anneta");
    const f = form(page);
    await choose(f.otherAmount);
    await f.otherAmountInput.fill("0");
    await expect(f.next).toBeDisabled();
    await f.otherAmountInput.fill("25");
    await expect(f.next).toBeEnabled();
  });

  test("keeps a draft through a reload", async ({ page }) => {
    await page.goto("/anneta");
    const f = form(page);
    await choose(f.single);
    await choose(f.amount(60));
    await f.next.click();
    await f.firstName.fill("Mälu");
    await page.reload();

    await expect(f.firstName).toHaveValue("Mälu");
    await page.getByRole("button", { name: "Step text 1" }).click();
    await expect(f.amount(60)).toBeChecked();
    await expect(f.single).toBeChecked();
  });

  test("starts one-off from a link that says so", async ({ page }) => {
    await page.goto("/anneta?type=onetime");
    await expect(form(page).single).toBeChecked();
  });

  test("leaves out an organization that takes no donations", async ({
    page,
  }) => {
    await page.goto(`/anneta?org=${ORGS.alpha.internalId}`);
    // The link's organization gets it all.
    await expect(
      page.getByRole("slider", { name: "Health and poverty" }),
    ).toHaveValue("100");
    await page.getByRole("button", { name: "Health and poverty" }).click();
    await expect(page.getByText(ORGS.alpha.title)).toBeVisible();
    await expect(page.getByText(ORGS.dormant.title)).toHaveCount(0);
  });

  test("reports the backend's refusal", async ({ page }) => {
    await page.route("**/api/donate", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: { status: 400, message: "Amount must be smaller" },
        }),
      }),
    );
    await page.goto("/anneta");
    await toConfirmation(page, {
      firstName: "Viga",
      lastName: "Vastus",
      email: uniqueEmail(),
    });
    const f = form(page);
    await f.terms.check();
    await f.donate.click();
    await expect(page.getByRole("dialog")).toContainText("Error text");
  });
});

test.describe("monthly donation", () => {
  test("with another bank shows how to set up the standing order", async ({
    page,
  }) => {
    await page.goto("/anneta");
    const f = form(page);
    await expect(f.recurring).toBeChecked();
    await choose(f.amount(10));
    await f.next.click();
    await fillDetails(page, {
      firstName: "Kuu",
      lastName: "Kaupa",
      email: uniqueEmail(),
    });
    await f.next.click();
    await f.next.click();
    await f.terms.check();
    // A monthly donation needs a bank.
    await expect(f.donate).toBeDisabled();
    await choose(page.getByRole("radio", { name: "Other bank text" }));
    await f.donate.click();

    await expect(
      page.getByText("Set up a standing order of 10€."),
    ).toBeVisible();
  });

  test("with a bank sends the donor to its standing order page", async ({
    page,
  }) => {
    // The bank's own page is outside the test; it's enough that we go there.
    await page.route("https://www.swedbank.ee/**", (route) =>
      route.fulfill({ body: "Swedbank standing order" }),
    );
    await page.goto("/anneta");
    const f = form(page);
    await f.next.click();
    await fillDetails(page, {
      firstName: "Pank",
      lastName: "Link",
      email: uniqueEmail(),
    });
    await f.next.click();
    await f.next.click();
    await f.terms.check();
    await choose(page.getByRole("radio", { name: "swedbank" }));
    await f.donate.click();
    await page.waitForURL(/swedbank\.ee/);
    const order = new URL(page.url()).searchParams;
    expect(order.get("standingOrder.amount")).toBe("30");
    expect(order.get("standingOrder.beneficiaryAccountNumber")).toBe(
      DONATION_INFO.iban,
    );
    expect(order.get("standingOrder.beneficiaryName")).toBe(
      DONATION_INFO.recipient,
    );
  });
});
