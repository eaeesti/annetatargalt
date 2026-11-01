import { describe, it, expect, vi } from "vitest";
import type { Core } from "@strapi/strapi";
import noContentUpload from "../no-content-upload";

async function request(path: string) {
  const ctx: { path: string; status: number; body: unknown } = {
    path,
    status: 404,
    body: null,
  };
  const next = vi.fn(async () => {});
  // oxlint-disable-next-line typescript/consistent-type-assertions
  const strapi = {} as unknown as Core.Strapi;
  await noContentUpload({}, { strapi })(
    // oxlint-disable-next-line typescript/consistent-type-assertions
    ctx as unknown as Parameters<ReturnType<Core.MiddlewareFactory>>[0],
    next,
  );
  return { status: ctx.status, passed: next.mock.calls.length > 0 };
}

describe("no content upload", () => {
  it("refuses Strapi's upload endpoints, whatever the token", async () => {
    for (const path of [
      "/api/upload",
      "/api/upload/",
      "/api/upload/files",
      "/api/upload/files/7",
      "/API/Upload",
    ]) {
      expect(await request(path)).toEqual({ status: 403, passed: false });
    }
  });

  it("lets everything else through", async () => {
    for (const path of [
      "/api/uploads-of-ours",
      "/api/admin-panel/emails/images",
      "/upload",
      "/api/pages",
    ]) {
      expect((await request(path)).passed).toBe(true);
    }
  });
});
