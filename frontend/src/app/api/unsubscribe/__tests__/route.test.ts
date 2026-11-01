import { afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Where the CMS has the settings page in each language
vi.mock("@/utils/cms", () => ({
  emailPreferencesPath: async (locale: string) =>
    locale === "en" ? "/en/notifications" : "/teavitused",
}));

const opened = async (query: string) =>
  (
    await GET(
      new NextRequest(`https://annetatargalt.example/api/unsubscribe?${query}`),
    )
  ).headers.get("location");

describe("opening the unsubscribe link", () => {
  it("goes to the settings page in the email's language, with the token kept from servers", async () => {
    expect(await opened("token=1.abc&kind=newsletter&locale=en")).toBe(
      "https://annetatargalt.example/en/notifications#token=1.abc",
    );
    expect(await opened("token=1.abc&kind=newsletter&locale=xx")).toBe(
      "https://annetatargalt.example/teavitused#token=1.abc",
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
