import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import type { JWTVerifyGetKey } from "jose";
import { verifyGoogleIdToken } from "../google-id-token";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const DOMAIN = "example.org";
const NONCE = "test-nonce";
const expectations = { clientId: CLIENT_ID, domain: DOMAIN, nonce: NONCE };

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let keys: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

function token(
  claims: Record<string, unknown> = {},
  {
    key = signingKey,
    issuer = "https://accounts.google.com",
    audience = CLIENT_ID,
    expiresIn = "1h",
  }: {
    key?: CryptoKey;
    issuer?: string;
    audience?: string;
    expiresIn?: string | number;
  } = {},
) {
  return new SignJWT({
    email: "person@example.org",
    email_verified: true,
    hd: DOMAIN,
    nonce: NONCE,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

describe("verifyGoogleIdToken", () => {
  it("accepts a Workspace account on the domain", async () => {
    expect(
      await verifyGoogleIdToken(await token(), expectations, keys),
    ).toEqual({ ok: true, email: "person@example.org" });
  });

  it("lowercases the email", async () => {
    const result = await verifyGoogleIdToken(
      await token({ email: "Person@Example.org", hd: "Example.org" }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: true, email: "person@example.org" });
  });

  it("accepts the issuer without the scheme too", async () => {
    const result = await verifyGoogleIdToken(
      await token({}, { issuer: "accounts.google.com" }),
      expectations,
      keys,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a token signed by another key", async () => {
    const result = await verifyGoogleIdToken(
      await token({}, { key: otherKey }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a token issued to another client", async () => {
    const result = await verifyGoogleIdToken(
      await token({}, { audience: "someone-else.apps.googleusercontent.com" }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a token from another issuer", async () => {
    const result = await verifyGoogleIdToken(
      await token({}, { issuer: "https://evil.example" }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an expired token", async () => {
    const result = await verifyGoogleIdToken(
      await token({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a token from a different sign-in", async () => {
    const result = await verifyGoogleIdToken(
      await token({ nonce: "another-nonce" }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects everything when the expected nonce is empty", async () => {
    const result = await verifyGoogleIdToken(
      await token({ nonce: "" }),
      { ...expectations, nonce: "" },
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a personal Google account with the domain's address", async () => {
    // No hd: the address is on the domain, but no Workspace vouches for it.
    const result = await verifyGoogleIdToken(
      await token({ hd: undefined }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "wrong-domain" });
  });

  it("rejects an account from another Workspace", async () => {
    const result = await verifyGoogleIdToken(
      await token({ email: "person@other.org", hd: "other.org" }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "wrong-domain" });
  });

  it("rejects an address on another of the Workspace's domains", async () => {
    const result = await verifyGoogleIdToken(
      await token({ email: "person@alias.example" }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "wrong-domain" });
  });

  it("rejects a lookalike domain", async () => {
    const result = await verifyGoogleIdToken(
      await token({ email: "person@notexample.org", hd: "notexample.org" }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "wrong-domain" });
  });

  it("rejects an unverified email", async () => {
    const result = await verifyGoogleIdToken(
      await token({ email_verified: false }),
      expectations,
      keys,
    );
    expect(result).toEqual({ ok: false, reason: "unverified-email" });
  });
});
