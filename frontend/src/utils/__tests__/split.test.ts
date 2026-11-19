import { describe, it, expect } from "vitest";
import {
  evenShares,
  isEven,
  isStartingSplit,
  moveBorder,
  scaleShares,
  startingShares,
  startingSplit,
  toggledShares,
} from "../split";

describe("evenShares", () => {
  it("splits 100 evenly, the first ones taking the remainder", () => {
    expect(evenShares(1)).toEqual([100]);
    expect(evenShares(2)).toEqual([50, 50]);
    expect(evenShares(3)).toEqual([34, 33, 33]);
    expect(evenShares(6)).toEqual([17, 17, 17, 17, 16, 16]);
  });

  it("has nothing to split among none", () => {
    expect(evenShares(0)).toEqual([]);
  });

  it("splits another total", () => {
    expect(evenShares(3, 95)).toEqual([32, 32, 31]);
    expect(evenShares(2, 95)).toEqual([48, 47]);
  });
});

describe("startingShares", () => {
  it("splits evenly between the causes without support", () => {
    expect(startingShares(3, false)).toEqual([34, 33, 33]);
    expect(startingShares(0, false)).toEqual([]);
  });

  it("gives support 5%, last, and the causes the rest", () => {
    expect(startingShares(1, true)).toEqual([95, 5]);
    expect(startingShares(3, true)).toEqual([32, 32, 31, 5]);
  });

  it("gives support all of it on its own", () => {
    expect(startingShares(0, true)).toEqual([100]);
  });
});

describe("moveBorder", () => {
  it("moves money only between the border's two neighbours", () => {
    expect(moveBorder([34, 33, 33], 0, 50)).toEqual([50, 17, 33]);
    expect(moveBorder([34, 33, 33], 1, 90)).toEqual([34, 56, 10]);
  });

  it("keeps each neighbour at 1% or more", () => {
    expect(moveBorder([50, 50], 0, 0)).toEqual([1, 99]);
    expect(moveBorder([50, 50], 0, 100)).toEqual([99, 1]);
    expect(moveBorder([34, 33, 33], 1, 10)).toEqual([34, 1, 65]);
  });

  it("rounds to whole percents", () => {
    expect(moveBorder([50, 50], 0, 42.6)).toEqual([43, 57]);
  });

  it("leaves the shares alone for a border that isn't there", () => {
    expect(moveBorder([100], 0, 30)).toEqual([100]);
    expect(moveBorder([50, 50], 1, 30)).toEqual([50, 50]);
  });
});

describe("isEven", () => {
  it("tells the even split from any other", () => {
    expect(isEven([34, 33, 33])).toBe(true);
    expect(isEven([33, 34, 33])).toBe(false);
    expect(isEven([100])).toBe(true);
  });
});

describe("scaleShares", () => {
  it("keeps the proportions, the largest remainders rounding up", () => {
    expect(scaleShares([70, 30], 95)).toEqual([67, 28]);
    expect(scaleShares([67, 28], 100)).toEqual([71, 29]);
    expect(scaleShares([34, 33, 33], 95)).toEqual([32, 32, 31]);
  });

  it("keeps every share at 1 or more", () => {
    expect(scaleShares([1, 99], 50)).toEqual([1, 49]);
    expect(scaleShares([1, 1, 98], 10)).toEqual([1, 1, 8]);
  });

  it("splits evenly what had nothing to go by", () => {
    expect(scaleShares([0, 0], 10)).toEqual([5, 5]);
  });
});

// Three causes and support, last, as on the donation form.
const SUPPORT = 3;

describe("startingSplit", () => {
  it("places the starting shares among every choice", () => {
    expect(startingSplit([true, true, false, true], SUPPORT)).toEqual([
      48, 47, 0, 5,
    ]);
    expect(startingSplit([false, false, false, true], SUPPORT)).toEqual([
      0, 0, 0, 100,
    ]);
    expect(startingSplit([false, true, true], -1)).toEqual([0, 50, 50]);
  });

  it("tells a split as it started from one adjusted", () => {
    expect(isStartingSplit([48, 47, 0, 5], SUPPORT)).toBe(true);
    expect(isStartingSplit([70, 25, 0, 5], SUPPORT)).toBe(false);
  });
});

describe("toggledShares", () => {
  it("keeps a split as it started even as choices come and go", () => {
    expect(toggledShares([0, 0, 0, 0], 0, SUPPORT)).toEqual([100, 0, 0, 0]);
    expect(toggledShares([100, 0, 0, 0], 1, SUPPORT)).toEqual([50, 50, 0, 0]);
    expect(toggledShares([50, 50, 0, 0], 3, SUPPORT)).toEqual([48, 47, 0, 5]);
    expect(toggledShares([48, 47, 0, 5], 3, SUPPORT)).toEqual([50, 50, 0, 0]);
    expect(toggledShares([0, 0, 0, 100], 0, SUPPORT)).toEqual([95, 0, 0, 5]);
  });

  it("gives support 5%, the adjusted causes making room in proportion", () => {
    expect(toggledShares([70, 30, 0, 0], 3, SUPPORT)).toEqual([67, 28, 0, 5]);
  });

  it("gives a cause ticked an even share, the others making room", () => {
    expect(toggledShares([70, 30, 0, 0], 2, SUPPORT)).toEqual([47, 20, 33, 0]);
    // support keeps its share
    expect(toggledShares([67, 28, 0, 5], 2, SUPPORT)).toEqual([44, 19, 32, 5]);
    expect(toggledShares([80, 0, 0, 20], 1, SUPPORT)).toEqual([40, 40, 0, 20]);
  });

  it("leaves what's unticked to the rest in proportion", () => {
    expect(toggledShares([44, 19, 32, 5], 2, SUPPORT)).toEqual([66, 29, 0, 5]);
    expect(toggledShares([67, 28, 0, 5], 3, SUPPORT)).toEqual([71, 29, 0, 0]);
    expect(toggledShares([80, 0, 0, 20], 0, SUPPORT)).toEqual([0, 0, 0, 100]);
    expect(toggledShares([80, 0, 0, 20], 3, SUPPORT)).toEqual([100, 0, 0, 0]);
  });

  it("splits a cause's charities the same way, without support", () => {
    expect(toggledShares([70, 30, 0], 2, -1)).toEqual([47, 20, 33]);
    expect(toggledShares([47, 20, 33], 0, -1)).toEqual([0, 38, 62]);
  });

  it("always adds up to 100 once something is chosen", () => {
    const cases: Array<[number[], number]> = [
      [[1, 98, 0, 1], 2],
      [[1, 1, 1, 97], 0],
      [[33, 33, 33, 1], 3],
      [[2, 1, 0, 97], 2],
    ];
    for (const [shares, index] of cases) {
      const split = toggledShares(shares, index, SUPPORT);
      expect(split.reduce((a, b) => a + b, 0)).toBe(100);
      expect(split.filter((share) => share > 0).length).toBe(
        shares.filter((share) => share > 0).length +
          (shares[index] > 0 ? -1 : 1),
      );
    }
  });
});
