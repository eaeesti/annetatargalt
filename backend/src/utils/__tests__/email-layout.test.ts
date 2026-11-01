import { describe, it, expect } from "vitest";
import { emailImageUrl, emailLayout, emailTextFooter } from "../email-layout";

const preferences = {
  url: "https://example.org/api/email-settings?locale=et#token=1.abc",
  text: "Choose your emails",
};

describe("emailImageUrl", () => {
  it("asks Cloudinary for an SVG as a PNG", () => {
    expect(
      emailImageUrl("https://res.cloudinary.com/x/image/upload/v1/logo.svg"),
    ).toBe("https://res.cloudinary.com/x/image/upload/w_360/v1/logo.png");
  });

  it("leaves other images as they are", () => {
    const png = "https://res.cloudinary.com/x/image/upload/v1/logo.png";
    expect(emailImageUrl(png)).toBe(png);
    const elsewhere = "https://example.org/logo.svg";
    expect(emailImageUrl(elsewhere)).toBe(elsewhere);
  });
});

describe("emailLayout", () => {
  it("puts the body, the footer and the link on the page", () => {
    const html = emailLayout({
      body: "<p>Hello <%= firstNameHtml %></p>",
      locale: "en",
      logo: { url: "https://example.org/logo.png", alt: "Logo" },
      footer: "Line one\nLine two",
      preferences,
    });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<p>Hello <%= firstNameHtml %></p>");
    expect(html).toContain('alt="Logo"');
    expect(html).toContain("Line one<br>Line two");
    expect(html).toContain(`href="${preferences.url}"`);
  });

  it("is 600 wide in Outlook for Windows too, which reads no max-width", () => {
    const html = emailLayout({
      body: "<p>Tere</p>",
      locale: "et",
      logo: null,
      footer: null,
      preferences: null,
    });
    expect(html).toContain(
      '<!--[if mso]><table role="presentation" width="600" align="center"',
    );
    expect(html).toContain('style="max-width: 600px;"');
    expect(html).toContain("padding: 40px;");
  });

  it("adds no template fields of its own", () => {
    // Strapi fills in <%= %> fields, and runs <% %> ones as code, after the
    // layout is added: text from the CMS in the footer can't become either.
    const html = emailLayout({
      body: "",
      locale: "et",
      logo: null,
      footer: "<% evil() %>",
      preferences: null,
    });
    expect(html).not.toContain("<%");
  });

  it("leaves out the link for someone who isn't a donor", () => {
    const html = emailLayout({
      body: "",
      locale: "et",
      logo: null,
      footer: null,
      preferences: null,
    });
    expect(html).not.toContain("<a ");
  });
});

describe("emailTextFooter", () => {
  it("has the footer and the link on lines of their own", () => {
    expect(emailTextFooter({ footer: "Sender", preferences })).toBe(
      `\n\nSender\nChoose your emails: ${preferences.url}`,
    );
  });

  it("is empty when there's neither", () => {
    expect(emailTextFooter({ footer: null, preferences: null })).toBe("");
  });
});
