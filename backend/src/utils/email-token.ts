import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The token in the link every email to a donor has, to the page where they
 * choose which emails they get: the donor's id, signed, so there's no account
 * to log in to. Whoever has the link can change that donor's emails and
 * nothing else, which is the most a forwarded email should allow.
 *
 * The secret is the app's own key, so a new key breaks the links in the
 * emails already sent.
 */
const PURPOSE = "email-preferences";

function signature(donorId: number, secret: string): string {
  // 22 characters of base64url are 132 bits, plenty for a link nobody can guess.
  return createHmac("sha256", secret)
    .update(`${PURPOSE}:${donorId}`)
    .digest("base64url")
    .slice(0, 22);
}

export function emailPreferencesToken(donorId: number, secret: string): string {
  return `${donorId}.${signature(donorId, secret)}`;
}

/** The donor a token is for, or null when it isn't one of ours. */
export function donorIdFromToken(
  token: unknown,
  secret: string,
): number | null {
  if (typeof token !== "string") return null;
  const match = /^(\d{1,9})\.([\w-]{22})$/.exec(token);
  if (!match) return null;
  const donorId = Number(match[1]);
  const expected = Buffer.from(signature(donorId, secret));
  const given = Buffer.from(match[2] ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? donorId
    : null;
}
