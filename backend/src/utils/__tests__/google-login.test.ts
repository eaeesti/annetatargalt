import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  authorizationUrl,
  googleClient,
  loginPageWithError,
  newLogin,
  pendingLogin,
  pkceChallenge,
  stateCookieValue,
} from "../google-login";

const CLIENT_ID = "123.apps.googleusercontent.com";

describe("googleClient", () => {
  it("needs the ID, the secret and the Workspace's domain", () => {
    expect(
      googleClient({
        STRAPI_GOOGLE_CLIENT_ID: " id ",
        STRAPI_GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_WORKSPACE_DOMAIN: " Example.ORG ",
      }),
    ).toEqual({
      clientId: "id",
      clientSecret: "secret",
      domain: "example.org",
    });
    // The donation admin panel's settings alone don't turn it on.
    expect(
      googleClient({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_WORKSPACE_DOMAIN: "example.org",
      }),
    ).toBeNull();
    expect(
      googleClient({
        STRAPI_GOOGLE_CLIENT_ID: "id",
        STRAPI_GOOGLE_CLIENT_SECRET: "secret",
      }),
    ).toBeNull();
    expect(
      googleClient({
        STRAPI_GOOGLE_CLIENT_ID: "id",
        STRAPI_GOOGLE_CLIENT_SECRET: " ",
        GOOGLE_WORKSPACE_DOMAIN: "example.org",
      }),
    ).toBeNull();
  });
});

describe("authorizationUrl", () => {
  const login = { state: "state", verifier: "verifier", nonce: "nonce" };
  const url = authorizationUrl(login, {
    clientId: CLIENT_ID,
    domain: "example.org",
    redirectUri: "https://cms.example/google-login/callback",
  });

  it("asks for a Workspace address only, with PKCE and a nonce", () => {
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(Object.fromEntries(parsed.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: "https://cms.example/google-login/callback",
      response_type: "code",
      scope: "openid email",
      state: "state",
      nonce: "nonce",
      code_challenge: pkceChallenge("verifier"),
      code_challenge_method: "S256",
      hd: "example.org",
    });
  });

  it("writes the space between scopes as %20, not +", () => {
    expect(url).toContain("scope=openid%20email");
    expect(url).not.toContain("+");
  });

  it("derives the challenge from the verifier with SHA-256", () => {
    expect(pkceChallenge("verifier")).toBe(
      createHash("sha256").update("verifier").digest("base64url"),
    );
  });
});

describe("pendingLogin", () => {
  const login = { state: "abc", verifier: "the-verifier", nonce: "the-nonce" };
  const cookie = stateCookieValue(login);

  it("returns the login when the state matches", () => {
    expect(pendingLogin(cookie, "abc")).toEqual(login);
  });

  it("refuses other states, a missing cookie and odd values", () => {
    expect(pendingLogin(cookie, "abd")).toBeNull();
    expect(pendingLogin(cookie, "ab")).toBeNull();
    expect(pendingLogin(cookie, ["abc"])).toBeNull();
    expect(pendingLogin(undefined, "abc")).toBeNull();
    expect(pendingLogin("abc", "abc")).toBeNull();
    expect(pendingLogin("abc.the-verifier", "abc")).toBeNull();
  });

  it("gives every login its own values, which survive the cookie", () => {
    const one = newLogin();
    const other = newLogin();
    expect(new Set([...Object.values(one), ...Object.values(other)]).size).toBe(
      6,
    );
    expect(pendingLogin(stateCookieValue(one), one.state)).toEqual(one);
  });
});

describe("loginPageWithError", () => {
  it("sends people back to the admin's login page", () => {
    expect(loginPageWithError("no-account")).toBe(
      "/admin/auth/login?google-login=no-account",
    );
  });
});
