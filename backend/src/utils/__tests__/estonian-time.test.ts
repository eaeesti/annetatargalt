import { describe, it, expect } from "vitest";
import {
  estonianDate,
  estonianDay,
  estonianMidnight,
  isoDate,
} from "../estonian-time";

describe("estonianMidnight", () => {
  it("is 22:00 UTC the day before in winter, 21:00 in summer", () => {
    expect(estonianMidnight(2026, 0, 1).toISOString()).toBe(
      "2025-12-31T22:00:00.000Z",
    );
    expect(estonianMidnight(2026, 6, 1).toISOString()).toBe(
      "2026-06-30T21:00:00.000Z",
    );
  });

  it("is right on the days the clocks change", () => {
    // 29 March and 25 October 2026
    expect(estonianMidnight(2026, 2, 29).toISOString()).toBe(
      "2026-03-28T22:00:00.000Z",
    );
    expect(estonianMidnight(2026, 2, 30).toISOString()).toBe(
      "2026-03-29T21:00:00.000Z",
    );
    expect(estonianMidnight(2026, 9, 25).toISOString()).toBe(
      "2026-10-24T21:00:00.000Z",
    );
    expect(estonianMidnight(2026, 9, 26).toISOString()).toBe(
      "2026-10-25T22:00:00.000Z",
    );
  });

  it("takes months out of range, like Date.UTC", () => {
    expect(estonianMidnight(2026, 12, 1).toISOString()).toBe(
      "2026-12-31T22:00:00.000Z",
    );
    expect(estonianMidnight(2026, -1, 1).toISOString()).toBe(
      "2025-11-30T22:00:00.000Z",
    );
  });
});

describe("estonianDate", () => {
  it("is the next day already in Estonia after 22:00 UTC in winter", () => {
    expect(estonianDate(new Date("2026-11-30T22:30:00Z"))).toEqual({
      year: 2026,
      month: 11,
      day: 1,
    });
    expect(estonianDate(new Date("2026-11-30T21:30:00Z"))).toEqual({
      year: 2026,
      month: 10,
      day: 30,
    });
  });
});

describe("estonianDay", () => {
  it("is the whole Estonian day", () => {
    expect(estonianDay("2026-06-30")?.map((d) => d.toISOString())).toEqual([
      "2026-06-29T21:00:00.000Z",
      "2026-06-30T21:00:00.000Z",
    ]);
  });

  it("is null for anything but a date", () => {
    expect(estonianDay("30.06.2026")).toBeNull();
    expect(estonianDay("2026-06-30T00:00:00Z")).toBeNull();
  });

  it("is null for a day that doesn't exist", () => {
    expect(estonianDay("2026-02-31")).toBeNull();
    expect(estonianDay("2026-13-01")).toBeNull();
    expect(estonianDay("2026-06-00")).toBeNull();
    expect(estonianDay("2028-02-29")).not.toBeNull();
  });
});

describe("isoDate", () => {
  it("writes a date the admin panel reads", () => {
    expect(isoDate(2026, 9)).toBe("2026-10-01");
    expect(isoDate(2026, 12)).toBe("2027-01-01");
  });
});
