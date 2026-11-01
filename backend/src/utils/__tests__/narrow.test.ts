import { describe, expect, it } from "vitest";
import { dayOf, idOf } from "../narrow";

describe("idOf", () => {
  it("is a row's id from a request", () => {
    expect(idOf("7")).toBe(7);
    expect(idOf("2147483647")).toBe(2_147_483_647);
  });

  it("is null for anything a serial column couldn't hold", () => {
    for (const value of [
      "1.5",
      "0",
      "-3",
      "1e3",
      " 7",
      "",
      "abc",
      "2147483648",
      "99999999999999999999",
      7,
      undefined,
    ]) {
      expect(idOf(value)).toBeNull();
    }
  });
});

describe("dayOf", () => {
  it("is a day from a request, as written", () => {
    expect(dayOf("2026-06-30")).toBe("2026-06-30");
    expect(dayOf(" 2028-02-29 ")).toBe("2028-02-29");
  });

  it("is undefined for anything but a day that exists", () => {
    for (const value of [
      "2026-02-31",
      "30.06.2026",
      "2026-6-30",
      "",
      20260630,
    ]) {
      expect(dayOf(value)).toBeUndefined();
    }
  });
});
