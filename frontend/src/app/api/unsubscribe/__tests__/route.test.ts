import { afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Where the CMS has the settings page in each language
vi.mock("@/utils/cms", () => ({
  emailPreferencesPath: async (locale: string) =>
    locale === "en" ? "/en/notifications" : "/teavitused",
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(path);
  },
}));

/** Where opening the link sends the browser. */
const opened = async (query: string) => {
  try {
    // Behind the proxy, a request's own address is the server's
    await GET(new NextRequest(`https://0.0.0.0:3000/api/unsubscribe?${query}`));
  } catch (error) {
    return error instanceof Error ? error.message : error;
  }
};

describe("opening the unsubscribe link", () => {
  it("goes to the settings page in the email's language, with the token kept from servers", async () => {
    expect(await opened("token=1.abc&kind=newsletter&locale=en")).toBe(
      "/en/notifications#token=1.abc",
    );
    expect(await opened("token=1.abc&kind=newsletter&locale=xx")).toBe(
      "/teavitused#token=1.abc",
    );
  });
});

describe("a mail client's unsubscribe button", () => {
  const clicked = async (backend: () => Promise<Response>) => {
    vi.stubGlobal("fetch", vi.fn(backend));
    const response = await POST(
      new NextRequest(
        "https://annetatargalt.example/api/unsubscribe?token=1.abc&kind=newsletter",
        { method: "POST" },
      ),
    );
    return response.status;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("turns the emails off, or says the link isn't ours", async () => {
    expect(await clicked(async () => new Response("{}"))).toBe(200);
    expect(await clicked(async () => new Response("{}", { status: 404 }))).toBe(
      404,
    );
  });

  it("asks to be tried again when the backend fails, and logs it without the token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await clicked(async () => new Response("{}", { status: 500 }))).toBe(
      503,
    );
    expect(
      await clicked(async () => {
        throw new TypeError("fetch failed");
      }),
    ).toBe(503);
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.join(" ")).not.toContain("1.abc");
  });
});
