export default class Proportions {
  constructor(entries) {
    const preparedEntries = entries.map(([key, value]) => [
      key,
      {
        locked: false,
        proportion: Math.floor(100 / entries.length),
        ...value,
      },
    ]);
    this.proportions = new Map(preparedEntries);
  }

  get(id) {
    return this.proportions.get(id);
  }

  getSub(id, subId) {
    return this.proportions.get(id).proportions.get(subId);
  }

  set(id, value) {
    this.proportions.set(id, value);
  }

  setSub(id, subId, value) {
    this.proportions.get(id).proportions.set(subId, value);
  }

  getProportion(id) {
    return this.proportions.get(id).proportion;
  }

  getSubProportion(id, subId) {
    return this.getSub(id, subId).proportion;
  }

  isLocked(id) {
    return this.proportions.get(id).locked;
  }

  isSubLocked(id, subId) {
    return this.getSub(id, subId).locked;
  }

  keys() {
    return Array.from(this.proportions.keys());
  }

  entries() {
    return Array.from(this.proportions.entries());
  }

  mapEntries(fun) {
    return new Proportions(
      this.entries().map(([key, value]) => fun(key, value)),
    );
  }

  proportionSum() {
    return [...this.proportions.values()].reduce(
      (sum, { proportion }) => sum + proportion,
      0,
    );
  }

  lockProportion(id) {
    return this.mapEntries((key, value) => [
      key,
      key === id ? { ...value, locked: true } : value,
    ]);
  }

  lockSubProportion(id, subId) {
    return this.mapEntries((key, value) => [
      key,
      key === id
        ? {
            ...value,
            proportions: value.proportions.lockProportion(subId),
          }
        : value,
    ]);
  }

  toggleProportionLock(id) {
    return this.mapEntries((key, value) => [
      key,
      key === id ? { ...value, locked: !value.locked } : value,
    ]);
  }

  toggleSubProportionLock(id, subId) {
    return this.mapEntries((key, value) => [
      key,
      key === id
        ? {
            ...value,
            proportions: value.proportions.toggleProportionLock(subId),
          }
        : value,
    ]);
  }

  updateProportion(id, proportion) {
    const newProportions = new Proportions(this.entries());

    const lockedProportions = [];
    const unlockedProportions = [];
    let totalLocked = 0;
    let totalUnlocked = 0;

    for (let key of this.keys()) {
      if (key === id) {
        continue;
      } else if (newProportions.isLocked(key)) {
        lockedProportions.push(key);
        totalLocked += Number(newProportions.getProportion(key));
      } else {
        unlockedProportions.push(key);
        totalUnlocked += Number(newProportions.getProportion(key));
      }
    }

    let newProportion;
    if (unlockedProportions.length === 0) {
      newProportion = newProportions.getProportion(id);
    } else if (totalLocked + proportion > 100) {
      newProportion = 100 - totalLocked;
    } else {
      newProportion = proportion;
    }

    newProportions.set(id, {
      ...newProportions.get(id),
      proportion: newProportion,
      locked: false,
    });
    const targetDelta = this.getProportion(id) - newProportion;

    if (targetDelta === 0) {
      newProportions.set(id, {
        ...newProportions.get(id),
        locked: true,
      });
      return newProportions;
    }

    const adder = targetDelta / Math.abs(targetDelta);
    for (let i = 0; i < Math.abs(targetDelta); i++) {
      let proportionsToChange;
      proportionsToChange = unlockedProportions.filter(
        (prop) => newProportions.getProportion(prop) > 0,
      );
      if (proportionsToChange.length === 0 && adder >= 0)
        proportionsToChange = unlockedProportions;
      let proportionToChangeIndex =
        (totalUnlocked - (adder < 0)) % proportionsToChange.length;
      const proportionToChange = proportionsToChange[proportionToChangeIndex];
      const oldProportion = newProportions.getProportion(proportionToChange);
      newProportions.set(proportionToChange, {
        ...newProportions.get(proportionToChange),
        proportion: oldProportion + adder,
        locked: false,
      });
      totalUnlocked += adder;
    }

    return newProportions;
  }

  updateSubProportion(id, subId, proportion) {
    return this.mapEntries((key, value) => [
      key,
      key === id
        ? {
            ...value,
            proportions: value.proportions.updateProportion(subId, proportion),
          }
        : value,
    ]);
  }

  toJSON() {
    return Object.fromEntries(
      this.entries().map(([key, value]) => [
        key,
        { ...value, locked: undefined },
      ]),
    );
  }

  static fromStrapiData(data) {
    const equalProportions = data.map(
      (_, i) => Math.floor(100 / data.length) + (i < 100 % data.length ? 1 : 0),
    );

    return new Proportions(
      data.map((cause, causeIndex) => [
        cause.id,
        {
          proportion: equalProportions[causeIndex],
          locked: false,
          proportions: new Proportions(
            cause.attributes.organizations.data.map(
              (organization, orgIndex) => [
                organization.id,
                {
                  proportion: orgIndex === 0 ? 100 : 0,
                  locked: false,
                },
              ],
            ),
          ),
        },
      ]),
    );
  }
}
