import { describe, it, expect } from "vitest";
import { classes } from "../react";

describe("classes", () => {
  it("joins class names with a space", () => {
    expect(classes("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(classes("foo", false, "bar")).toBe("foo bar");
    expect(classes("foo", null, undefined, "bar")).toBe("foo bar");
  });

  it("returns an empty string when all values are falsy", () => {
    expect(classes(false, null, undefined)).toBe("");
  });

  it("handles a single class", () => {
    expect(classes("foo")).toBe("foo");
  });
});
