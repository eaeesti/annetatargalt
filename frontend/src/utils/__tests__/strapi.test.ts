import { afterEach, describe, it, expect, vi } from "vitest";
import { describeErrorResponse, fetchAllAPI, getStrapiURL } from "../strapi";

describe("getStrapiURL", () => {
  it("returns base URL with empty path", () => {
    expect(getStrapiURL()).toBe("http://127.0.0.1:1337");
  });

  it("appends path to base URL", () => {
    expect(getStrapiURL("/api/pages")).toBe("http://127.0.0.1:1337/api/pages");
  });
});

describe("describeErrorResponse", () => {
  it("uses Strapi's error name and message", async () => {
    const response = Response.json(
      { error: { name: "ValidationError", message: "Invalid email" } },
      { status: 400, statusText: "Bad Request" },
    );
    expect(await describeErrorResponse(response)).toBe(
      "ValidationError: Invalid email",
    );
  });

  it("falls back to the status for a proxy's HTML error page", async () => {
    const response = new Response("<html>502 Bad Gateway</html>", {
      status: 502,
      statusText: "Bad Gateway",
    });
    expect(await describeErrorResponse(response)).toBe("502 Bad Gateway");
  });

  it("falls back to the status for JSON that isn't a Strapi error", async () => {
    const response = Response.json({ message: "nope" }, { status: 500 });
    expect(await describeErrorResponse(response)).toBe("500");
  });
});

describe("fetchAllAPI", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches every page of a collection, 100 entries at a time", async () => {
    const asked: URLSearchParams[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      const params = new URL(url).searchParams;
      asked.push(params);
      const page = Number(params.get("pagination[page]"));
      return Response.json({
        data: [`entry ${page}`],
        meta: { pagination: { page, pageSize: 100, pageCount: 3 } },
      });
    });

    const entries = await fetchAllAPI<string>("/pages", { locale: "et" });

    expect(entries).toEqual(["entry 1", "entry 2", "entry 3"]);
    expect(asked.map((params) => params.get("pagination[pageSize]"))).toEqual([
      "100",
      "100",
      "100",
    ]);
    expect(asked.every((params) => params.get("locale") === "et")).toBe(true);
  });

  it("stops after one page when the answer has no pagination", async () => {
    let requests = 0;
    vi.stubGlobal("fetch", async () => {
      requests++;
      return Response.json({ data: ["only"] });
    });

    expect(await fetchAllAPI<string>("/special-pages")).toEqual(["only"]);
    expect(requests).toBe(1);
  });
});
