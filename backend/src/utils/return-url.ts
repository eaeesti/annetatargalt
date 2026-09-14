/**
 * `donateExternal` takes a returnUrl from an unauthenticated request body and
 * hands it to the payment provider as the address to send the donor to once
 * they have paid. Unvalidated, that is an open redirect wearing this org's
 * domain and a real payment flow: a link that genuinely starts at the donation
 * page, genuinely takes a card payment, and lands the donor on a page the
 * attacker chose — which is about as much credibility as a phishing page can
 * be given.
 *
 * Only whole origins are compared. Matching on a prefix instead would accept
 * `https://annetatargalt.ee.example.com`, and matching on a suffix would
 * accept `https://notannetatargalt.ee`.
 */

// The org's own sites, which are the only origins this has ever been used
// with. Anything else — a genuine third-party partner embedding the widget —
// belongs in EXTERNAL_RETURN_ORIGINS rather than in this public repo.
const DEFAULT_ALLOWED_RETURN_ORIGINS = [
  "https://annetatargalt.ee",
  "https://www.annetatargalt.ee",
  "https://efektiivnealtruism.org",
  "https://www.efektiivnealtruism.org",
];

/**
 * Parsed per call rather than at module load so that changing the variable
 * takes effect on restart without a rebuild, and so a bad value can never
 * throw during startup.
 */
function allowedOrigins(): string[] {
  // Not env.array(): it falls back to the default only when the key is
  // entirely absent, so a bare `EXTERNAL_RETURN_ORIGINS=` would parse as [""]
  // rather than "nothing configured". Same reasoning as the CORS list.
  const raw = (process.env.EXTERNAL_RETURN_ORIGINS ?? "").trim();
  const configured = raw
    ? raw
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];

  return [...DEFAULT_ALLOWED_RETURN_ORIGINS, ...configured].map((origin) =>
    origin.toLowerCase(),
  );
}

export function isAllowedReturnUrl(returnUrl: unknown): boolean {
  if (typeof returnUrl !== "string" || !returnUrl.trim()) return false;

  let parsed: URL;
  try {
    parsed = new URL(returnUrl);
  } catch {
    // Not an absolute URL. Relative paths are rejected too: the donor is sent
    // here by the payment provider, so a path with no origin has nothing
    // sensible to resolve against.
    return false;
  }

  // `javascript:` and `data:` URLs parse successfully but have no meaningful
  // origin, so the scheme is checked explicitly rather than inferred.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  return allowedOrigins().includes(parsed.origin.toLowerCase());
}
