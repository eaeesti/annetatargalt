import { createHmac, timingSafeEqual } from "node:crypto";

/** HS256 tokens, the kind Montonio and the backend exchange. */

const base64url = (data: string | Buffer) =>
  Buffer.from(data).toString("base64url");

export function signJwt(payload: Record<string, unknown>, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({ iat: now, exp: now + 600, ...payload }),
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/** The token's payload, or null if it isn't signed with the secret. */
export function verifyJwt(
  token: string,
  secret: string,
): Record<string, unknown> | null {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const expected = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  const payload: unknown = JSON.parse(
    Buffer.from(body, "base64url").toString(),
  );
  return typeof payload === "object" && payload !== null
    ? Object.fromEntries(Object.entries(payload))
    : null;
}
