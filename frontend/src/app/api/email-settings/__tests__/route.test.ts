import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

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
    await GET(
      new NextRequest(`https://0.0.0.0:3000/api/email-settings?${query}`),
    );
  } catch (error) {
    return error instanceof Error ? error.message : error;
  }
};

describe("the link to a donor's settings", () => {
  it("goes to the settings page in its language, wherever the CMS has it, on the site's own address", async () => {
    expect(await opened("locale=en")).toBe("/en/notifications");
    expect(await opened("locale=et")).toBe("/teavitused");
    expect(await opened("")).toBe("/teavitused");
  });
});
