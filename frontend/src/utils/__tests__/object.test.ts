import { describe, it, expect } from "vitest";
import { at, isRecord, pick, stringField } from "../object";

describe("at", () => {
  it("returns values for the specified keys", () => {
    expect(at({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual([1, 3]);
  });

  it("preserves the original object key order", () => {
    expect(at({ a: 1, b: 2, c: 3 }, ["c", "a"])).toEqual([1, 3]);
  });

  it("skips keys not present in the object", () => {
    expect(at({ a: 1, b: 2 }, ["a", "z"])).toEqual([1]);
  });

  it("returns an empty array for no matching keys", () => {
    expect(at({ a: 1 }, ["x", "y"])).toEqual([]);
  });
});

describe("pick", () => {
  it("returns a subset object with the specified keys", () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });

  it("ignores keys not present in the object", () => {
    expect(pick({ a: 1, b: 2 }, ["a", "z"])).toEqual({ a: 1 });
  });

  it("returns an empty object when no keys match", () => {
    expect(pick({ a: 1 }, ["x"])).toEqual({});
  });
});

describe("stringField", () => {
  it("returns the string in the named field", () => {
    expect(stringField({ a: "x", b: "y" }, "b")).toBe("y");
  });

  it("returns null for a field that isn't a string", () => {
    expect(stringField({ a: 1, b: null }, "a")).toBeNull();
    expect(stringField({ a: 1, b: null }, "b")).toBeNull();
  });

  it("returns null for a field the object doesn't have", () => {
    expect(stringField({ a: "x" }, "z")).toBeNull();
  });
});

describe("isRecord", () => {
  it("accepts plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("rejects null, arrays and other values", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([1])).toBe(false);
    expect(isRecord("a")).toBe(false);
    expect(isRecord(1)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});
