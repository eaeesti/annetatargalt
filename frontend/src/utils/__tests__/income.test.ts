import { describe, it, expect } from "vitest";
import {
  compareIncome,
  equivalisedIncome,
  euroIncome,
  householdFromQuery,
  householdQuery,
  parseCount,
  parseIncome,
  worldPercentile,
  WORLD_MEDIAN_INCOME,
} from "../income";

describe("worldPercentile", () => {
  // What the calculator's earlier, separate site showed for the same incomes.
  it.each([
    [30, 1.7],
    [100, 16.3],
    [500, 71.7],
    [1000, 85],
    [1500, 90.9],
    [2000, 94.3],
    [3000, 97.5],
  ])("places %d € a month", (income, percentile) => {
    expect(worldPercentile(income)).toBeCloseTo(percentile, 1);
  });

  it("goes on past the 99th percentile along the last stretch of the data", () => {
    expect(worldPercentile(5000)).toBeCloseTo(99.8, 1);
  });

  it("stops at 99.9 and at the 1st percentile", () => {
    expect(worldPercentile(20000)).toBe(99.9);
    expect(worldPercentile(1)).toBe(1);
  });
});

describe("compareIncome", () => {
  it("rounds the richer share up to a whole percent", () => {
    expect(compareIncome(2000)).toMatchObject({ top: 6, percentile: 94 });
    expect(compareIncome(1500)).toMatchObject({ top: 10, percentile: 90 });
  });

  it("keeps a decimal below 1%", () => {
    expect(compareIncome(5000)).toMatchObject({ top: 0.2, percentile: 99.8 });
    expect(compareIncome(20000)).toMatchObject({ top: 0.1, percentile: 99.9 });
  });

  it("says how many times the world's median an income is", () => {
    expect(compareIncome(2000).timesMedian).toBeCloseTo(8.39164, 4);
  });

  it("has the world's median in international dollars a month", () => {
    expect(WORLD_MEDIAN_INCOME).toBeCloseTo(280.01925, 4);
    expect(euroIncome(WORLD_MEDIAN_INCOME) * 12).toBeCloseTo(2860, 0);
  });
});

describe("equivalisedIncome", () => {
  it("leaves one adult's income as it is", () => {
    expect(equivalisedIncome({ income: 2000, adults: 1, children: 0 })).toBe(
      2000,
    );
  });

  it("counts another adult as 0.7 and a child as 0.5", () => {
    expect(
      equivalisedIncome({ income: 3400, adults: 2, children: 0 }),
    ).toBeCloseTo(2000);
    expect(
      equivalisedIncome({ income: 4000, adults: 2, children: 2 }),
    ).toBeCloseTo(1481.48, 2);
  });
});

describe("parseIncome", () => {
  it("reads a decimal point or comma and spaces", () => {
    expect(parseIncome("2000")).toBe(2000);
    expect(parseIncome("2 500,50")).toBe(2500.5);
    expect(parseIncome("1234.5")).toBe(1234.5);
    expect(parseIncome(",5")).toBe(0.5);
  });

  it("refuses anything else, and nothing", () => {
    expect(parseIncome("")).toBeNull();
    expect(parseIncome("0")).toBeNull();
    expect(parseIncome("12.345")).toBeNull();
    expect(parseIncome("-5")).toBeNull();
    expect(parseIncome("1e3")).toBeNull();
    expect(parseIncome("kaks")).toBeNull();
  });
});

describe("parseCount", () => {
  it("reads whole numbers in range", () => {
    expect(parseCount("2", 1, 10)).toBe(2);
    expect(parseCount("0", 0, 10)).toBe(0);
  });

  it("refuses the rest", () => {
    expect(parseCount("0", 1, 10)).toBeNull();
    expect(parseCount("11", 1, 10)).toBeNull();
    expect(parseCount("1.5", 1, 10)).toBeNull();
    expect(parseCount(null, 1, 10)).toBeNull();
  });
});

describe("householdFromQuery", () => {
  const query = (text: string) => new URLSearchParams(text);

  it("reads a household and back", () => {
    const household = { income: 2500.5, adults: 2, children: 1 };
    expect(householdFromQuery(query(householdQuery(household)))).toEqual(
      household,
    );
  });

  it("takes one adult on their own when the query doesn't say", () => {
    expect(householdFromQuery(query("income=1500"))).toEqual({
      income: 1500,
      adults: 1,
      children: 0,
    });
  });

  it("is null for anything it can't read", () => {
    expect(householdFromQuery(query(""))).toBeNull();
    expect(householdFromQuery(query("income=abc"))).toBeNull();
    expect(householdFromQuery(query("income=1500&adults=0"))).toBeNull();
    expect(householdFromQuery(query("income=1500&children=99"))).toBeNull();
  });
});
