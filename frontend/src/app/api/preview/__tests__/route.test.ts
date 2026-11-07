import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mode = vi.hoisted(() => ({ enable: vi.fn(), disable: vi.fn() }));
vi.mock("next/headers", () => ({ draftMode: async () => mode }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect ${path}`);
  },
}));

const { GET } = await import("../route");

function open(query: Record<string, string>) {
  return GET(
    new NextRequest(
      `https://example.org/api/preview?${new URLSearchParams(query)}`,
    ),
  );
}

describe("the preview link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PREVIEW_SECRET", "secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("turns on drafts and goes to the page with the shared secret", async () => {
    await expect(
      open({ path: "/blogi/uus", secret: "secret" }),
    ).rejects.toThrow("redirect /blogi/uus");
    expect(mode.enable).toHaveBeenCalledOnce();
  });

  it("is refused with any other secret", async () => {
    const response = await open({ path: "/", secret: "guess" });

    expect(response.status).toBe(401);
    expect(mode.enable).not.toHaveBeenCalled();
  });

  it("is refused when the site has no secret", async () => {
    vi.stubEnv("PREVIEW_SECRET", "");

    const response = await open({ path: "/", secret: "" });

    expect(response.status).toBe(401);
  });

  it("turns drafts off for a published version, without the secret", async () => {
    await expect(open({ path: "/en", status: "published" })).rejects.toThrow(
      "redirect /en",
    );
    expect(mode.disable).toHaveBeenCalledOnce();
  });

  it("goes only to a path on this site", async () => {
    for (const path of ["https://evil.example", "//evil.example", "/\\evil"]) {
      await expect(open({ path, secret: "secret" })).rejects.toThrow(
        "redirect /",
      );
    }
  });
});
