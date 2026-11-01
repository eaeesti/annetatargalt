import { sanitize } from "./string";
import type { Locale } from "./locale";

interface EmailLayoutOptions {
  /** The email's own HTML, as written in Strapi's email config. */
  body: string;
  locale: Locale;
  logo: { url: string; alt: string } | null;
  /** A line or two about who sends it, as plain text. */
  footer: string | null;
  /**
   * The link to the page where a donor chooses which emails they get. None
   * for someone who isn't a donor, such as the person a donation was
   * dedicated to.
   */
  preferences: { url: string; text: string } | null;
}

/** How wide the white card is, at most, and its padding, in pixels. */
const CARD_WIDTH = 600;
const CARD_PADDING = 40;

/** How wide what's written on the card can be: a picture's widest. */
export const CARD_TEXT_WIDTH = CARD_WIDTH - 2 * CARD_PADDING;

// The site's colours: slate for text and the background, primary-700 for
// the brand green.
const BACKGROUND = "#f1f5f9";
const TEXT = "#334155";
const MUTED = "#64748b";
const GREEN = "#047857";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Most email clients keep a stylesheet in the head, but some drop it: so the
 * layout's own styles are inline, and this only styles the body the team
 * wrote, which reads fine without it too.
 */
const BODY_STYLES = `
.content p { margin: 0 0 16px; }
.content h1, .content h2, .content h3 { margin: 24px 0 12px; color: ${GREEN}; line-height: 1.3; }
.content h1 { font-size: 24px; }
.content h2 { font-size: 20px; }
.content h3 { font-size: 17px; }
.content ul, .content ol { margin: 0 0 16px; padding-left: 24px; }
.content li { margin: 0 0 6px; }
.content img { max-width: 100%; height: auto; border-radius: 8px; }
.content hr { margin: 24px 0; border: 0; border-top: 1px solid #e2e8f0; }
.content strong { color: ${GREEN}; }
.content a { color: ${GREEN}; }
.content pre { margin: 0 0 16px; padding: 16px 20px; background: #f8fafc; border-radius: 8px; font-family: ${FONT}; font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
.content blockquote { margin: 0 0 16px; padding: 4px 0 4px 16px; border-left: 3px solid #b2ddc9; color: #475569; }
@media (max-width: 600px) { .content { padding: 28px 20px !important; } }
`;

/**
 * An image the site has as an SVG, as a PNG for email, which few clients
 * show SVGs in. Cloudinary converts it when asked for the .png, here at twice
 * the width the layout shows it at.
 */
export function emailImageUrl(url: string): string {
  if (!url.includes("/image/upload/") || !url.endsWith(".svg")) return url;
  return (
    url.replace("/image/upload/", "/image/upload/w_360/").slice(0, -4) + ".png"
  );
}

/**
 * The page every email is laid out on: the logo, the email itself on a white
 * card, and under it who sends it and the link to choose which emails to get.
 * Tables and inline styles, since that's what every email client shows alike,
 * and a table of the card's width for Outlook for Windows, which reads no
 * max-width.
 */
export function emailLayout({
  body,
  locale,
  logo,
  footer,
  preferences,
}: EmailLayoutOptions): string {
  const logoRow = logo
    ? `<tr><td align="center" style="padding: 0 0 24px;"><img src="${sanitize(emailImageUrl(logo.url))}" width="180" alt="${sanitize(logo.alt)}" style="display: block; border: 0; width: 180px; max-width: 100%; height: auto;"></td></tr>`
    : "";
  const footerLines = [
    ...(footer ? footer.split("\n").map((line) => sanitize(line)) : []),
    ...(preferences
      ? [
          `<a href="${sanitize(preferences.url)}" style="color: ${MUTED}; text-decoration: underline;">${sanitize(preferences.text)}</a>`,
        ]
      : []),
  ];
  const footerRow = footerLines.length
    ? `<tr><td align="center" style="padding: 24px 16px 0; font-family: ${FONT}; font-size: 13px; line-height: 1.6; color: ${MUTED};">${footerLines.join("<br>")}</td></tr>`
    : "";

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>${BODY_STYLES}</style>
</head>
<body style="margin: 0; padding: 0; background: ${BACKGROUND};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${BACKGROUND};">
<tr><td align="center" style="padding: 32px 12px;">
<!--[if mso]><table role="presentation" width="${CARD_WIDTH}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: ${CARD_WIDTH}px;">
${logoRow}
<tr><td class="content" style="background: #ffffff; border-radius: 12px; padding: ${CARD_PADDING}px; font-family: ${FONT}; font-size: 16px; line-height: 1.6; color: ${TEXT};">
${body}
</td></tr>
${footerRow}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

/** The plain-text version's footer, the same lines as the layout's. */
export function emailTextFooter({
  footer,
  preferences,
}: Pick<EmailLayoutOptions, "footer" | "preferences">): string {
  const lines = [
    ...(footer ? [footer] : []),
    ...(preferences ? [`${preferences.text}: ${preferences.url}`] : []),
  ];
  return lines.length ? `\n\n${lines.join("\n")}` : "";
}
