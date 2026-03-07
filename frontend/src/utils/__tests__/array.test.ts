import { describe, it, expect } from "vitest";
import { range } from "../array";

describe("range", () => {
  it("generates a range from 0 with one argument", () => {
    expect(range(5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("generates a range between two numbers", () => {
    expect(range(2, 5)).toEqual([2, 3, 4]);
  });

  it("returns an empty array when start >= end", () => {
    expect(range(5, 1)).toEqual([]);
    expect(range(3, 3)).toEqual([]);
  });

  it("handles range(0)", () => {
    expect(range(0)).toEqual([]);
  });

  it("handles range(1)", () => {
    expect(range(1)).toEqual([0]);
  });
});
