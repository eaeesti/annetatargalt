import { afterEach, describe, it, expect, vi } from "vitest";
import { emailPreferencesPath } from "../cms";

/** The CMS's pages, as a list answers them. */
const pages = (data: unknown[]) => async () =>
  new Response(
    JSON.stringify({ data, meta: { pagination: { pageCount: 1 } } }),
  );

describe("emailPreferencesPath", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is the page with the email settings, as the CMS names it now", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        pages([
          { slug: "kkk", sections: [] },
          {
            slug: "email-settings",
            sections: [{ __component: "sections.email-preferences-section" }],
          },
        ]),
      ),
    );
    expect(await emailPreferencesPath("en")).toBe("/en/email-settings");
    expect(await emailPreferencesPath("et")).toBe("/email-settings");
  });

  it("is the Estonian page when the language has none", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        pages(
          url.includes("locale=en")
            ? [{ slug: "faq", sections: [] }]
            : [
                {
                  slug: "teavitused",
                  sections: [
                    { __component: "sections.email-preferences-section" },
                  ],
                },
              ],
        )(),
      ),
    );
    expect(await emailPreferencesPath("en")).toBe("/teavitused");
    expect(log).toHaveBeenCalled();
  });

  it("is the front page, logged, without one", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(pages([{ slug: "kkk", sections: [] }])));
    expect(await emailPreferencesPath("en")).toBe("/en");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    expect(await emailPreferencesPath("et")).toBe("/");
    expect(log).toHaveBeenCalled();
  });
});
