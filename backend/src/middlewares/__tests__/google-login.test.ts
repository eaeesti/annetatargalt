import type { Core } from "@strapi/strapi";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import type { JWTVerifyGetKey } from "jose";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import googleLogin from "../google-login";

// Google's keys, swapped for a test key the tokens below are signed with.
const google = vi.hoisted(() => {
  const holder: { keys: JWTVerifyGetKey | null } = { keys: null };
  return holder;
});
vi.mock("jose", async (original) => ({
  ...(await original<typeof import("jose")>()),
  createRemoteJWKSet: (): JWTVerifyGetKey => (header, token) => {
    if (!google.keys) throw new Error("no test keys");
    return google.keys(header, token);
  },
}));

const CLIENT_ID = "123.apps.googleusercontent.com";
const DOMAIN = "example.org";

let signingKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  google.keys = createLocalJWKSet({ keys: [jwk] });
});

interface FakeUser {
  id: number;
  email: string;
  isActive: boolean;
  blocked: boolean;
  registrationToken: string | null;
}

const editor: FakeUser = {
  id: 2,
  email: "editor@example.org",
  isActive: true,
  blocked: false,
  registrationToken: null,
};
const invited: FakeUser = {
  id: 3,
  email: "invited@example.org",
  isActive: false,
  blocked: false,
  registrationToken: "invite-token",
};

/** As Google issues them: only Workspace accounts carry `hd`. */
function idToken(email: string, nonce: string): Promise<string> {
  const domain = email.split("@")[1]?.toLowerCase();
  return new SignJWT({
    email,
    email_verified: true,
    nonce,
    ...(domain === DOMAIN ? { hd: domain } : {}),
  })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer("https://accounts.google.com")
    .setAudience(CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(signingKey);
}

function matches(user: FakeUser, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === "object" && "$eqi" in condition) {
      return (
        typeof condition.$eqi === "string" &&
        user.email.toLowerCase() === condition.$eqi.toLowerCase()
      );
    }
    return Object.entries(user).some(
      ([field, value]) => field === key && value === condition,
    );
  });
}

const log = () => vi.fn<(message: string) => void>();

function fakeStrapi(users: FakeUser[]) {
  const updates: unknown[] = [];
  const sessions = {
    generateRefreshToken: vi.fn<
      (...args: unknown[]) => Promise<{
        token: string;
        sessionId: string;
        absoluteExpiresAt: string;
      }>
    >(async () => ({
      token: "refresh-token",
      sessionId: "session",
      absoluteExpiresAt: "",
    })),
    generateAccessToken: vi.fn<() => Promise<{ token: string }>>(async () => ({
      token: "access-token",
    })),
  };
  const strapi = {
    db: {
      query: () => ({
        findOne: async ({ where }: { where: Record<string, unknown> }) =>
          users.find((user) => matches(user, where)) ?? null,
        update: async (args: unknown) => {
          updates.push(args);
          return null;
        },
      }),
    },
    config: { get: () => undefined },
    log: { info: log(), warn: log(), error: log() },
    sessionManager: () => sessions,
  };
  // oxlint-disable-next-line typescript/consistent-type-assertions
  return { strapi: strapi as unknown as Core.Strapi, updates, sessions };
}

interface SetCookie {
  name: string;
  value: string | null;
  options: Record<string, unknown>;
}

interface FakeContext {
  method: string;
  path: string;
  query: Record<string, string>;
  origin: string;
  request: { body: unknown; secure: boolean };
  status: number;
  body: unknown;
  redirectedTo: string | null;
  redirect(url: string): void;
  cookies: {
    get(name: string): string | undefined;
    set(name: string, value: string | null, options?: object): void;
  };
}

/** Enough of Koa's context for the middleware. */
function fakeContext(init: {
  method?: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  cookies?: Map<string, string>;
}) {
  const jar = init.cookies ?? new Map<string, string>();
  const setCookies: SetCookie[] = [];
  const ctx: FakeContext = {
    method: init.method ?? "GET",
    path: init.path,
    query: init.query ?? {},
    origin: "https://cms.example",
    request: { body: init.body, secure: true },
    status: 404,
    body: undefined,
    redirectedTo: null,
    redirect(url: string) {
      this.redirectedTo = url;
    },
    cookies: {
      get: (name: string) => jar.get(name),
      set: (name, value, options = {}) => {
        setCookies.push({ name, value, options: { ...options } });
        if (value === null) jar.delete(name);
        else jar.set(name, value);
      },
    },
  };
  return { ctx, jar, setCookies };
}

async function run(strapi: Core.Strapi, ctx: FakeContext) {
  const next = vi.fn<() => Promise<void>>(async () => {});
  // oxlint-disable-next-line typescript/consistent-type-assertions
  await googleLogin({}, { strapi })(ctx as never, next);
  return next;
}

function cookie(setCookies: SetCookie[], name: string) {
  return setCookies.find((set) => set.name === name);
}

/**
 * Starts a login and comes back from Google as `email`, with the nonce the
 * login was started with unless `nonce` says otherwise.
 */
async function roundTrip(
  users: FakeUser[],
  email: string,
  { nonce }: { nonce?: string } = {},
) {
  const fake = fakeStrapi(users);
  const start = fakeContext({ path: "/google-login" });
  await run(fake.strapi, start.ctx);
  const google = new URL(start.ctx.redirectedTo ?? "");
  const state = google.searchParams.get("state") ?? "";
  const token = await idToken(
    email,
    nonce ?? google.searchParams.get("nonce") ?? "",
  );

  const fetch = vi.fn<
    (url: string, init: { body: URLSearchParams }) => Promise<Response>
  >(
    async () =>
      new Response(JSON.stringify({ id_token: token }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetch);
  const back = fakeContext({
    path: "/google-login/callback",
    query: { state, code: "auth-code" },
    cookies: start.jar,
  });
  await run(fake.strapi, back.ctx);
  return { ...fake, google, fetch, start, back };
}

describe("google-login middleware", () => {
  beforeEach(() => {
    vi.stubEnv("STRAPI_GOOGLE_CLIENT_ID", CLIENT_ID);
    vi.stubEnv("STRAPI_GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("GOOGLE_WORKSPACE_DOMAIN", DOMAIN);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("logging in with Google", () => {
    it("sends people to Google with a state, a nonce and a PKCE challenge", async () => {
      const { google, fetch } = await roundTrip([editor], editor.email);
      expect(google.origin).toBe("https://accounts.google.com");
      expect(google.searchParams.get("redirect_uri")).toBe(
        "https://cms.example/google-login/callback",
      );
      expect(google.searchParams.get("nonce")).toBeTruthy();
      expect(google.searchParams.get("code_challenge")).toBeTruthy();
      expect(google.searchParams.get("hd")).toBe(DOMAIN);
      // The token request proves it holds the verifier behind the challenge.
      const [, request] = fetch.mock.calls[0];
      expect(request.body.get("code")).toBe("auth-code");
      expect(request.body.get("code_verifier")).toBeTruthy();
    });

    it("logs an existing user in to the admin, as Strapi's login does", async () => {
      const { back, sessions } = await roundTrip([editor], editor.email);
      expect(back.ctx.redirectedTo).toBe("/admin");
      expect(sessions.generateRefreshToken).toHaveBeenCalledWith(
        "2",
        expect.any(String),
        { type: "session" },
      );
      expect(cookie(back.setCookies, "strapi_admin_refresh")).toMatchObject({
        value: "refresh-token",
        options: { httpOnly: true, path: "/admin", sameSite: "lax" },
      });
      expect(cookie(back.setCookies, "jwtToken")).toMatchObject({
        value: "access-token",
        options: { httpOnly: false, path: "/admin" },
      });
    });

    it("keeps the state in a host-only cookie over HTTPS", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { start, back } = await roundTrip([editor], editor.email);
      // A __Host- cookie can't be planted by another subdomain's site.
      expect(
        cookie(start.setCookies, "__Host-strapi_google_login"),
      ).toMatchObject({ options: { secure: true, httpOnly: true, path: "/" } });
      expect(
        cookie(back.setCookies, "__Host-strapi_google_login"),
      ).toMatchObject({ value: null, options: { secure: true, path: "/" } });
      expect(back.ctx.redirectedTo).toBe("/admin");
    });

    it("matches the address whatever its case", async () => {
      const { back } = await roundTrip([editor], "Editor@Example.ORG");
      expect(back.ctx.redirectedTo).toBe("/admin");
    });

    it("activates invited users, without an invite link", async () => {
      const { back, updates } = await roundTrip([invited], invited.email);
      expect(back.ctx.redirectedTo).toBe("/admin");
      expect(updates).toEqual([
        {
          where: { id: 3 },
          data: { isActive: true, registrationToken: null },
        },
      ]);
    });

    it("keeps out users an administrator switched off", async () => {
      const { back, updates, sessions } = await roundTrip(
        [{ ...editor, isActive: false }],
        editor.email,
      );
      expect(back.ctx.redirectedTo).toBe(
        "/admin/auth/login?google-login=no-account",
      );
      expect(updates).toEqual([]);
      expect(sessions.generateRefreshToken).not.toHaveBeenCalled();
    });

    it("turns away accounts outside the Workspace", async () => {
      const { back, sessions } = await roundTrip(
        [{ ...editor, email: "editor@gmail.com" }],
        "editor@gmail.com",
      );
      expect(back.ctx.redirectedTo).toBe(
        "/admin/auth/login?google-login=wrong-account",
      );
      expect(sessions.generateRefreshToken).not.toHaveBeenCalled();
    });

    it("turns away addresses without an account, and blocked users", async () => {
      const stranger = await roundTrip([editor], "someone@example.org");
      expect(stranger.back.ctx.redirectedTo).toBe(
        "/admin/auth/login?google-login=no-account",
      );
      expect(stranger.sessions.generateRefreshToken).not.toHaveBeenCalled();

      const blocked = await roundTrip(
        [{ ...editor, blocked: true }],
        editor.email,
      );
      expect(blocked.back.ctx.redirectedTo).toBe(
        "/admin/auth/login?google-login=no-account",
      );
    });

    it("refuses a token from another login, by its nonce", async () => {
      const { back, sessions } = await roundTrip([editor], editor.email, {
        nonce: "another-login",
      });
      expect(back.ctx.redirectedTo).toBe(
        "/admin/auth/login?google-login=failed",
      );
      expect(sessions.generateRefreshToken).not.toHaveBeenCalled();
    });

    it("refuses a token Google didn't sign", async () => {
      const fake = fakeStrapi([editor]);
      const start = fakeContext({ path: "/google-login" });
      await run(fake.strapi, start.ctx);
      const google = new URL(start.ctx.redirectedTo ?? "");
      const signed = await idToken(
        editor.email,
        google.searchParams.get("nonce") ?? "",
      );
      const [header, payload] = signed.split(".");
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({ id_token: `${header}.${payload}.forged` }),
            ),
        ),
      );
      const back = fakeContext({
        path: "/google-login/callback",
        query: { state: google.searchParams.get("state") ?? "", code: "c" },
        cookies: start.jar,
      });
      await run(fake.strapi, back.ctx);
      expect(back.ctx.redirectedTo).toBe(
        "/admin/auth/login?google-login=failed",
      );
      expect(fake.sessions.generateRefreshToken).not.toHaveBeenCalled();
    });

    it("refuses a callback whose state isn't the one it gave out", async () => {
      const fake = fakeStrapi([editor]);
      const fetch = vi.fn<typeof globalThis.fetch>();
      vi.stubGlobal("fetch", fetch);
      const forged = fakeContext({
        path: "/google-login/callback",
        query: { state: "forged", code: "auth-code" },
        cookies: new Map([["strapi_google_login", "real.verifier.nonce"]]),
      });
      await run(fake.strapi, forged.ctx);
      expect(forged.ctx.redirectedTo).toBe(
        "/admin/auth/login?google-login=failed",
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("says so when the person cancels at Google", async () => {
      const fake = fakeStrapi([editor]);
      const cancelled = fakeContext({
        path: "/google-login/callback",
        query: { error: "access_denied", state: "x" },
      });
      await run(fake.strapi, cancelled.ctx);
      expect(cancelled.ctx.redirectedTo).toBe(
        "/admin/auth/login?google-login=cancelled",
      );
    });
  });

  describe("passwords", () => {
    it.each([
      ["/admin/login", { email: editor.email, password: "x" }],
      ["/admin/login", { email: "nobody@example.com", password: "x" }],
      ["/admin/forgot-password", { email: editor.email }],
      ["/admin/reset-password", { resetPasswordToken: "t", password: "x" }],
      ["/admin/register", { registrationToken: "invite-token" }],
      ["/admin/register-admin", { email: "new@example.com", password: "x" }],
      // Strapi's router ignores case and a trailing slash, so these reach
      // the same handlers.
      ["/admin/login/", { email: editor.email, password: "x" }],
      ["/admin/LOGIN", { email: editor.email, password: "x" }],
      ["/Admin/Login/", { email: editor.email, password: "x" }],
      ["/admin/Forgot-Password/", { email: editor.email }],
      ["/admin/reset-password/", { resetPasswordToken: "t", password: "x" }],
      ["/admin/REGISTER/", { registrationToken: "invite-token" }],
    ])("refuses %s, for everyone", async (path, body) => {
      const { strapi } = fakeStrapi([editor, invited]);
      const { ctx } = fakeContext({ method: "POST", path, body });
      expect(await run(strapi, ctx)).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
      expect(ctx.body).toMatchObject({
        error: { message: expect.stringContaining("Google") },
      });
    });

    it.each(["/admin/logout", "/admin/access-token", "/admin/login-x"])(
      "leaves %s to Strapi",
      async (path) => {
        const { strapi } = fakeStrapi([editor]);
        const { ctx } = fakeContext({ method: "POST", path });
        expect(await run(strapi, ctx)).toHaveBeenCalled();
      },
    );
  });

  describe("without the client's secret", () => {
    beforeEach(() => {
      vi.stubEnv("STRAPI_GOOGLE_CLIENT_SECRET", "");
    });

    it("leaves passwords alone and hides the button", async () => {
      const { strapi } = fakeStrapi([editor]);
      const login = fakeContext({
        method: "POST",
        path: "/admin/login",
        body: { email: editor.email, password: "x" },
      });
      expect(await run(strapi, login.ctx)).toHaveBeenCalled();

      const status = fakeContext({ path: "/google-login/enabled" });
      await run(strapi, status.ctx);
      expect(status.ctx.body).toEqual({ enabled: false, domain: null });

      const start = fakeContext({ path: "/google-login" });
      expect(await run(strapi, start.ctx)).toHaveBeenCalled();
    });
  });
});
