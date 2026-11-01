import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** The hook as the page runs it, from public/js. */
function hook(): (type: string, payload: Record<string, string>) => unknown {
  const source = readFileSync(
    path.join(__dirname, "../../../public/js/umami-before-send.js"),
    "utf8",
  );
  const window: Record<string, unknown> = {};
  new Function("window", "location", source)(window, {
    href: "https://annetatargalt.example/",
  });
  const found = window.umamiBeforeSend;
  if (typeof found !== "function") throw new Error("No hook");
  return (type, payload) => found(type, payload);
}

describe("what Umami is sent", () => {
  it("leaves out the query string, but for campaign tags, and the fragment", () => {
    expect(
      hook()("pageview", {
        url: "https://annetatargalt.example/teavitused?utm_source=kiri&q=mari#token=1.abc",
        referrer: "https://elsewhere.example/page?id=7",
      }),
    ).toEqual({
      url: "https://annetatargalt.example/teavitused?utm_source=kiri",
      referrer: "https://elsewhere.example/page",
    });
  });
});
