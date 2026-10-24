import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import adminAuthController from "../admin-auth";
import { verifyGoogleIdToken } from "../../../../utils/google-id-token";

vi.mock("../../../../utils/google-id-token", () => ({
  verifyGoogleIdToken: vi.fn(),
}));
const verify = vi.mocked(verifyGoogleIdToken);

const EMAIL = "person@example.org";

interface FakeAdmin {
  isActive?: boolean;
  blocked?: boolean | null;
  roles?: { code: string }[];
}

function fakeStrapi(admin: FakeAdmin | null) {
  const createUser = vi.fn(async ({ data }: { data: { email: string } }) => ({
    id: 7,
    email: data.email,
  }));
  const issue = vi.fn(async () => "issued-jwt");
  const queries: Record<string, unknown> = {
    "admin::user": { findOne: vi.fn(async () => admin) },
    "plugin::users-permissions.user": {
      findOne: vi.fn(async () => null),
      create: createUser,
    },
    "plugin::users-permissions.role": {
      findOne: vi.fn(async () => ({ id: 3, name: "DonationAdmin" })),
    },
  };
  const strapi = {
    db: { query: (uid: string) => queries[uid] },
    plugin: () => ({ service: () => ({ issue }) }),
  };
  // A test double for Strapi, which can't be built whole in a test.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  return { strapi: strapi as unknown as Core.Strapi, createUser, issue };
}

// Records which response helper the controller answered with.
function fakeCtx(body: Record<string, unknown>) {
  const answer = (kind: string) =>
    vi.fn((message?: unknown, details?: unknown) => ({
      kind,
      message,
      details,
    }));
  const ctx = {
    request: { body, ip: "203.0.113.1" },
    notFound: answer("notFound"),
    badRequest: answer("badRequest"),
    unauthorized: answer("unauthorized"),
    forbidden: answer("forbidden"),
    send: vi.fn((data: unknown) => ({ kind: "send", data })),
  };
  // A test double for Koa's context, which can't be built whole in a test.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  return ctx as unknown as Context;
}

const signIn = { idToken: "token", nonce: "nonce" };
const bridgeable = {
  isActive: true,
  blocked: false,
  roles: [{ code: "strapi-super-admin" }],
};

describe("admin-auth google()", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_WORKSPACE_DOMAIN", "example.org");
    verify.mockReset();
    verify.mockResolvedValue({ ok: true, email: EMAIL });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues a session for an active admin in a bridgeable role", async () => {
    const { strapi, createUser, issue } = fakeStrapi(bridgeable);
    const result = await adminAuthController({ strapi }).google(
      fakeCtx(signIn),
    );

    expect(result).toEqual({
      kind: "send",
      data: { jwt: "issued-jwt", user: { id: 7, email: EMAIL } },
    });
    expect(verify).toHaveBeenCalledWith("token", {
      clientId: "client-id",
      domain: "example.org",
      nonce: "nonce",
    });
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: EMAIL, role: 3 }),
      }),
    );
    expect(issue).toHaveBeenCalledWith({ id: 7 });
  });

  it("is off until both settings are present", async () => {
    vi.stubEnv("GOOGLE_WORKSPACE_DOMAIN", "");
    const { strapi } = fakeStrapi(bridgeable);
    const result = await adminAuthController({ strapi }).google(
      fakeCtx(signIn),
    );
    expect(result).toMatchObject({ kind: "notFound" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("needs a token and a nonce", async () => {
    const { strapi } = fakeStrapi(bridgeable);
    const result = await adminAuthController({ strapi }).google(
      fakeCtx({ idToken: "token" }),
    );
    expect(result).toMatchObject({ kind: "badRequest" });
  });

  it("passes on why a token was refused", async () => {
    verify.mockResolvedValue({ ok: false, reason: "wrong-domain" });
    const { strapi, issue } = fakeStrapi(bridgeable);
    const result = await adminAuthController({ strapi }).google(
      fakeCtx(signIn),
    );
    expect(result).toMatchObject({
      kind: "unauthorized",
      details: { reason: "wrong-domain" },
    });
    expect(issue).not.toHaveBeenCalled();
  });

  it.each([
    ["has no admin account", null],
    ["is deactivated", { ...bridgeable, isActive: false }],
    ["is blocked", { ...bridgeable, blocked: true }],
    [
      "is in a role without panel access",
      { ...bridgeable, roles: [{ code: "strapi-editor" }] },
    ],
  ])("refuses someone who %s", async (_, admin) => {
    const { strapi, issue } = fakeStrapi(admin);
    const result = await adminAuthController({ strapi }).google(
      fakeCtx(signIn),
    );
    expect(result).toMatchObject({ kind: "forbidden" });
    expect(issue).not.toHaveBeenCalled();
  });
});

describe("admin-auth login()", () => {
  // Strapi's own /admin/login does the password check; stand in for it.
  function stubAdminLogin(ok: boolean) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: ok ? 200 : 400 })),
    );
  }

  beforeEach(() => {
    // Password sign-in only exists where Google sign-in isn't set up.
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_WORKSPACE_DOMAIN", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is off where Google sign-in is configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_WORKSPACE_DOMAIN", "example.org");
    stubAdminLogin(true);
    const { strapi, issue } = fakeStrapi(bridgeable);
    const result = await adminAuthController({ strapi }).login(
      fakeCtx({ email: "off@example.org", password: "secret" }),
    );
    expect(result).toMatchObject({ kind: "notFound" });
    // Not even checked against Strapi: the password never leaves this process.
    expect(fetch).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it("issues a session for an admin in a bridgeable role", async () => {
    stubAdminLogin(true);
    const { strapi, issue } = fakeStrapi(bridgeable);
    const result = await adminAuthController({ strapi }).login(
      fakeCtx({ email: "Person@Example.org", password: "secret" }),
    );
    expect(result).toEqual({
      kind: "send",
      data: { jwt: "issued-jwt", user: { id: 7, email: EMAIL } },
    });
    expect(issue).toHaveBeenCalledWith({ id: 7 });
  });

  it("refuses a wrong password", async () => {
    stubAdminLogin(false);
    const { strapi, issue } = fakeStrapi(bridgeable);
    const result = await adminAuthController({ strapi }).login(
      fakeCtx({ email: "wrong-password@example.org", password: "nope" }),
    );
    expect(result).toMatchObject({ kind: "unauthorized" });
    expect(issue).not.toHaveBeenCalled();
  });

  it("refuses an admin in a role without panel access", async () => {
    stubAdminLogin(true);
    const { strapi, issue } = fakeStrapi({
      ...bridgeable,
      roles: [{ code: "strapi-editor" }],
    });
    const result = await adminAuthController({ strapi }).login(
      fakeCtx({ email: "editor@example.org", password: "secret" }),
    );
    expect(result).toMatchObject({ kind: "forbidden" });
    expect(issue).not.toHaveBeenCalled();
  });
});
