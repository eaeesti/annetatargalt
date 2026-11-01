import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

// Where the CMS has the settings page in each language
vi.mock("@/utils/cms", () => ({
  emailPreferencesPath: async (locale: string) =>
    locale === "en" ? "/en/notifications" : "/teavitused",
}));

const opened = async (query: string) =>
  (
    await GET(
      new NextRequest(
        `https://annetatargalt.example/api/email-settings?${query}`,
      ),
    )
  ).headers.get("location");

describe("the link to a donor's settings", () => {
  it("goes to the settings page in its language, wherever the CMS has it", async () => {
    expect(await opened("locale=en")).toBe(
      "https://annetatargalt.example/en/notifications",
    );
    expect(await opened("locale=et")).toBe(
      "https://annetatargalt.example/teavitused",
    );
    expect(await opened("")).toBe("https://annetatargalt.example/teavitused");
  });
});
