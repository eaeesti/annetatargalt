import { describe, expect, it } from "vitest";
import { keptShare } from "../language-scroll";

const kept = (share: number, path = "/en/faq", at = 1000) =>
  JSON.stringify({ path, share, at });

describe("keptShare", () => {
  it("is the share kept for this page just now", () => {
    expect(keptShare(kept(0.4), "/en/faq", 2000)).toBe(0.4);
  });

  it("is nothing for another page, or once it's old", () => {
    expect(keptShare(kept(0.4), "/kkk", 2000)).toBeNull();
    expect(keptShare(kept(0.4), "/en/faq", 60_000)).toBeNull();
  });

  it("is nothing for what isn't a kept share", () => {
    expect(keptShare(null, "/en/faq", 2000)).toBeNull();
    expect(keptShare("not json", "/en/faq", 2000)).toBeNull();
    expect(keptShare(kept(2), "/en/faq", 2000)).toBeNull();
    expect(keptShare('{"path":"/en/faq"}', "/en/faq", 2000)).toBeNull();
  });
});
