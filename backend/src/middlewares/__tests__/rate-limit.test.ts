import { describe, it, expect, vi } from "vitest";
import type { Core } from "@strapi/strapi";
import rateLimit from "../rate-limit";

/** Signed-in people's tokens, to the ids they're for. */
const tokens = new Map([
  ["mari", 1],
  ["jaan", 2],
]);

const strapi = {
  plugin: () => ({
    service: () => ({
      getToken: async (ctx: {
        request: { header: { authorization?: string } };
      }) => {
        const token = ctx.request.header.authorization?.replace("Bearer ", "");
        const id = token ? tokens.get(token) : undefined;
        if (token && id === undefined) throw new Error("Invalid token.");
        return id === undefined ? null : { id };
      },
    }),
  }),
};

// oxlint-disable-next-line typescript/consistent-type-assertions
const limit = rateLimit({}, { strapi: strapi as unknown as Core.Strapi });

/** Make `count` requests, the status of the last. */
async function requests(count: number, ip: string, token?: string) {
  let status = 0;
  for (let i = 0; i < count; i++) {
    const ctx = {
      request: {
        ip,
        header: token ? { authorization: `Bearer ${token}` } : {},
      },
      state: {},
      status: 404,
      body: null,
      set: () => {},
    };
    // oxlint-disable-next-line typescript/consistent-type-assertions
    const koaCtx = ctx as unknown as Parameters<typeof limit>[0];
    await limit(
      koaCtx,
      vi.fn(async () => {
        ctx.status = 200;
      }),
    );
    status = ctx.status;
  }
  return status;
}

describe("the rate limit", () => {
  it("lets an address make 1000 requests in a window, and no more", async () => {
    expect(await requests(1000, "198.51.100.1")).toBe(200);
    expect(await requests(1, "198.51.100.1")).toBe(429);
    expect(await requests(1, "198.51.100.2")).toBe(200);
  });

  it("counts signed-in people each on their own, not by their address", async () => {
    // The admin panel's server: one address for everyone signed in
    const server = "203.0.113.7";
    expect(await requests(1000, server)).toBe(200);
    expect(await requests(1, server)).toBe(429);
    expect(await requests(4999, server, "mari")).toBe(200);
    expect(await requests(1, server, "jaan")).toBe(200);
    // Even a signed-in person has a limit
    expect(await requests(2, server, "mari")).toBe(429);
  });

  it("counts a token that isn't valid by its address", async () => {
    expect(await requests(1000, "198.51.100.9", "forged")).toBe(200);
    expect(await requests(1, "198.51.100.9", "forged")).toBe(429);
  });

  it("doesn't count the site's server, which fetches every page's content", async () => {
    // A container's private address, and loopback
    expect(await requests(1100, "172.20.0.2")).toBe(200);
    expect(await requests(1100, "::ffff:127.0.0.1")).toBe(200);
  });
});
