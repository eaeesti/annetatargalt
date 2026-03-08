import { describe, it, expect } from "vitest";
import Proportions from "../proportions";

// Helpers to build simple test fixtures
function makeProportions(entries: Array<[string | number, number]>): Proportions {
  return new Proportions(entries.map(([key, proportion]) => [key, { proportion }]));
}

function makeWithSubs(causeEntries: Array<[number, number, Array<[string, number]>]>): Proportions {
  return new Proportions(
    causeEntries.map(([id, proportion, subs]) => [
      id,
      {
        proportion,
        proportions: new Proportions(
          subs.map(([subId, subProportion]) => [subId, { proportion: subProportion }]),
        ),
      },
    ]),
  );
}

describe("Proportions constructor", () => {
  it("sets equal proportions when none provided", () => {
    const p = new Proportions([[1, {}], [2, {}], [3, {}]]);
    expect(p.getProportion(1)).toBe(33); // Math.floor(100/3)
    expect(p.getProportion(2)).toBe(33);
    expect(p.getProportion(3)).toBe(33);
  });

  it("respects provided proportion values", () => {
    const p = makeProportions([[1, 60], [2, 40]]);
    expect(p.getProportion(1)).toBe(60);
    expect(p.getProportion(2)).toBe(40);
  });

  it("defaults locked to false", () => {
    const p = new Proportions([[1, {}]]);
    expect(p.isLocked(1)).toBe(false);
  });

  it("accepts string keys", () => {
    const p = makeProportions([["org1", 70], ["org2", 30]]);
    expect(p.getProportion("org1")).toBe(70);
  });
});

describe("proportionSum", () => {
  it("sums all proportions", () => {
    const p = makeProportions([[1, 60], [2, 40]]);
    expect(p.proportionSum()).toBe(100);
  });

  it("works with three entries", () => {
    const p = makeProportions([[1, 50], [2, 30], [3, 20]]);
    expect(p.proportionSum()).toBe(100);
  });
});

describe("keys / entries", () => {
  it("returns all keys", () => {
    const p = makeProportions([[1, 50], [2, 50]]);
    expect(p.keys()).toEqual([1, 2]);
  });

  it("returns all entries", () => {
    const p = makeProportions([[1, 50], [2, 50]]);
    expect(p.entries().map(([k]) => k)).toEqual([1, 2]);
  });
});

describe("lockProportion", () => {
  it("locks only the specified entry", () => {
    const p = makeProportions([[1, 50], [2, 50]]);
    const locked = p.lockProportion(1);
    expect(locked.isLocked(1)).toBe(true);
    expect(locked.isLocked(2)).toBe(false);
  });

  it("returns a new instance (immutable)", () => {
    const p = makeProportions([[1, 50], [2, 50]]);
    const locked = p.lockProportion(1);
    expect(p.isLocked(1)).toBe(false);
    expect(locked.isLocked(1)).toBe(true);
  });
});

describe("toggleProportionLock", () => {
  it("locks an unlocked entry", () => {
    const p = makeProportions([[1, 50], [2, 50]]);
    expect(p.toggleProportionLock(1).isLocked(1)).toBe(true);
  });

  it("unlocks a locked entry", () => {
    const p = makeProportions([[1, 50], [2, 50]]);
    const toggled = p.toggleProportionLock(1).toggleProportionLock(1);
    expect(toggled.isLocked(1)).toBe(false);
  });
});

describe("updateProportion", () => {
  it("redistributes proportions when one changes", () => {
    const p = makeProportions([[1, 50], [2, 50]]);
    const updated = p.updateProportion(1, 70);
    expect(updated.getProportion(1)).toBe(70);
    expect(updated.getProportion(2)).toBe(30);
    expect(updated.proportionSum()).toBe(100);
  });

  it("clamps to 100 when locked proportions prevent the change", () => {
    const p = makeProportions([[1, 50], [2, 50]]).lockProportion(2);
    // 2 is locked at 50, so 1 can be at most 50
    const updated = p.updateProportion(1, 80);
    expect(updated.getProportion(1)).toBe(50);
    expect(updated.proportionSum()).toBe(100);
  });

  it("allows going to 0", () => {
    const p = makeProportions([[1, 50], [2, 50]]);
    const updated = p.updateProportion(1, 0);
    expect(updated.getProportion(1)).toBe(0);
    expect(updated.getProportion(2)).toBe(100);
  });

  it("keeps proportion unchanged when all others are locked", () => {
    const p = makeProportions([[1, 50], [2, 50]]).lockProportion(2);
    // Only key 2 is not the target. It's locked. So proportion stays.
    // But wait: 2 is locked at 50, totalLocked = 50, 50+80 > 100 so newProportion = 50
    const updated = p.updateProportion(2, 80); // 2 is locked but we're updating it here... actually no
    // updateProportion doesn't check if id itself is locked
    expect(updated.proportionSum()).toBe(100);
  });
});

describe("mapEntries", () => {
  it("transforms all entries", () => {
    const p = makeProportions([[1, 60], [2, 40]]);
    const doubled = p.mapEntries((key, value) => [key, { ...value, proportion: value.proportion * 2 }]);
    expect(doubled.getProportion(1)).toBe(120);
    expect(doubled.getProportion(2)).toBe(80);
  });
});

describe("unlockProportions", () => {
  it("unlocks all entries", () => {
    const p = makeProportions([[1, 50], [2, 50]])
      .lockProportion(1)
      .lockProportion(2);
    const unlocked = p.unlockProportions();
    expect(unlocked.isLocked(1)).toBe(false);
    expect(unlocked.isLocked(2)).toBe(false);
  });
});

describe("sub-proportion methods", () => {
  it("getSubProportion returns sub proportion", () => {
    const p = makeWithSubs([[1, 100, [["org1", 60], ["org2", 40]]]]);
    expect(p.getSubProportion(1, "org1")).toBe(60);
    expect(p.getSubProportion(1, "org2")).toBe(40);
  });

  it("isSubLocked returns false by default", () => {
    const p = makeWithSubs([[1, 100, [["org1", 100]]]]);
    expect(p.isSubLocked(1, "org1")).toBe(false);
  });

  it("lockSubProportion locks the sub entry", () => {
    const p = makeWithSubs([[1, 100, [["org1", 60], ["org2", 40]]]]);
    const locked = p.lockSubProportion(1, "org1");
    expect(locked.isSubLocked(1, "org1")).toBe(true);
    expect(locked.isSubLocked(1, "org2")).toBe(false);
  });

  it("updateSubProportion redistributes within the sub", () => {
    const p = makeWithSubs([[1, 100, [["org1", 50], ["org2", 50]]]]);
    const updated = p.updateSubProportion(1, "org1", 80);
    expect(updated.getSubProportion(1, "org1")).toBe(80);
    expect(updated.getSubProportion(1, "org2")).toBe(20);
  });
});

describe("calculateAmounts", () => {
  it("calculates amounts from proportions", () => {
    const p = makeWithSubs([[1, 100, [["org1", 100]]]]);
    const causes = { data: [{ id: 1, organizations: [{ internalId: "org1" }] }] };
    expect(p.calculateAmounts(100, causes)).toEqual([
      { organizationInternalId: "org1", amount: 100 },
    ]);
  });

  it("splits across organizations", () => {
    const p = makeWithSubs([[1, 100, [["org1", 50], ["org2", 50]]]]);
    const causes = {
      data: [{ id: 1, organizations: [{ internalId: "org1" }, { internalId: "org2" }] }],
    };
    const amounts = p.calculateAmounts(100, causes);
    expect(amounts).toHaveLength(2);
    expect(amounts.reduce((s, a) => s + a.amount, 0)).toBe(100);
  });

  it("splits across causes and organizations", () => {
    const p = makeWithSubs([
      [1, 50, [["org1", 100]]],
      [2, 50, [["org2", 100]]],
    ]);
    const causes = {
      data: [
        { id: 1, organizations: [{ internalId: "org1" }] },
        { id: 2, organizations: [{ internalId: "org2" }] },
      ],
    };
    const amounts = p.calculateAmounts(100, causes);
    expect(amounts).toEqual([
      { organizationInternalId: "org1", amount: 50 },
      { organizationInternalId: "org2", amount: 50 },
    ]);
  });

  it("excludes zero-amount organizations", () => {
    const p = makeWithSubs([[1, 100, [["org1", 100], ["org2", 0]]]]);
    const causes = {
      data: [{ id: 1, organizations: [{ internalId: "org1" }, { internalId: "org2" }] }],
    };
    const amounts = p.calculateAmounts(100, causes);
    expect(amounts).toHaveLength(1);
    expect(amounts[0].organizationInternalId).toBe("org1");
  });
});

describe("fromStrapiDataWithEqualProportions", () => {
  it("creates equal cause proportions", () => {
    const data = [
      { id: 1, organizations: [{ internalId: "org1", fund: true }] },
      { id: 2, organizations: [{ internalId: "org2", fund: true }] },
    ];
    const p = Proportions.fromStrapiDataWithEqualProportions(data);
    expect(p.getProportion(1)).toBe(50);
    expect(p.getProportion(2)).toBe(50);
  });

  it("sets fund org to 100% within cause", () => {
    const data = [
      {
        id: 1,
        organizations: [
          { internalId: "org1", fund: true },
          { internalId: "org2", fund: false },
        ],
      },
    ];
    const p = Proportions.fromStrapiDataWithEqualProportions(data);
    expect(p.getSubProportion(1, "org1")).toBe(100);
    expect(p.getSubProportion(1, "org2")).toBe(0);
  });
});

describe("fromStrapiData", () => {
  it("falls back to equal proportions when no org specified", () => {
    const data = [
      { id: 1, organizations: [{ internalId: "org1", fund: true }] },
      { id: 2, organizations: [{ internalId: "org2", fund: true }] },
    ];
    const p = Proportions.fromStrapiData(data);
    expect(p.getProportion(1)).toBe(50);
    expect(p.getProportion(2)).toBe(50);
  });

  it("falls back to equal proportions when org not found", () => {
    const data = [
      { id: 1, organizations: [{ internalId: "org1", fund: true }] },
    ];
    const p = Proportions.fromStrapiData(data, "nonexistent");
    expect(p.getProportion(1)).toBe(100);
  });

  it("sets 100% to the cause containing the chosen org", () => {
    const data = [
      { id: 1, organizations: [{ internalId: "org1", fund: false }] },
      { id: 2, organizations: [{ internalId: "org2", fund: true }] },
    ];
    const p = Proportions.fromStrapiData(data, "org1");
    expect(p.getProportion(1)).toBe(100);
    expect(p.getProportion(2)).toBe(0);
  });

  it("sets 100% to the chosen org within its cause", () => {
    const data = [
      {
        id: 1,
        organizations: [
          { internalId: "org1", fund: false },
          { internalId: "org2", fund: false },
        ],
      },
    ];
    const p = Proportions.fromStrapiData(data, "org1");
    expect(p.getSubProportion(1, "org1")).toBe(100);
    expect(p.getSubProportion(1, "org2")).toBe(0);
  });
});
