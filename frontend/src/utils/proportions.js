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

  goesToFund(id) {
    return this.proportions.get(id).toFund;
  }

  toggleToFund(id) {
    let newProportions = this;

    if (!this.goesToFund(id)) {
      const fundId = this.subKeys(id).find(
        (subId) => this.getSub(id, subId).fund,
      );
      newProportions = newProportions
        .unlockSubProportions(id)
        .updateSubProportion(id, fundId, 100)
        .unlockSubProportions(id);
    }

    return newProportions.mapEntries((key, value) => [
      key,
      key === id ? { ...value, toFund: !value.toFund } : value,
    ]);
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

  subKeys(id) {
    return Array.from(this.get(id).proportions.keys());
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

  unlockProportions() {
    return this.mapEntries((key, value) => [key, { ...value, locked: false }]);
  }

  unlockSubProportions(id) {
    return this.mapEntries((key, value) => [
      key,
      key === id
        ? { ...value, proportions: value.proportions.unlockProportions() }
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
      this.entries()
        .map(([key, value]) => [
          key,
          { proportion: value.proportion, proportions: value.proportions },
        ])
        .filter(([_, value]) => value.proportion > 0),
    );
  }

  calculateAmounts(totalAmount, causes) {
    const amounts = [];

    causes.data.forEach((cause) => {
      const causeProportion = this.getProportion(cause.id);
      cause.attributes.organizations.data.forEach((organization) => {
        const organizationProportion = this.getSubProportion(
          cause.id,
          organization.id,
        );
        const proportion = (causeProportion * organizationProportion) / 10000;
        const amount = totalAmount * proportion;
        const roundedAmount = Math.round(amount * 100) / 100;
        if (roundedAmount > 0) {
          amounts.push({
            organizationId: organization.id,
            amount: roundedAmount,
          });
        }
      });
    });

    // Avoid rounding errors
    const total = amounts.reduce((sum, item) => sum + item.amount, 0);
    if (total !== totalAmount) {
      const discrepancy = Math.round((totalAmount - total) * 100) / 100;
      const timesToAdd = Math.floor(Math.abs(discrepancy) / 0.01);
      const adder = discrepancy / timesToAdd;

      for (let i = 0; i < timesToAdd; i++) {
        const index = amounts.length - 1 - (i % amounts.length);
        amounts[index].amount =
          Math.round((amounts[index].amount + adder) * 100) / 100;
      }
    }

    return amounts;
  }

  static fromStrapiDataWithEqualProportions(data) {
    const equalProportions = data.map(
      (_, i) => Math.floor(100 / data.length) + (i < 100 % data.length ? 1 : 0),
    );

    return new Proportions(
      data.map((cause, causeIndex) => [
        cause.id,
        {
          proportion: equalProportions[causeIndex],
          locked: false,
          toFund: true,
          proportions: new Proportions(
            cause.attributes.organizations.data.map((organization) => [
              organization.id,
              {
                proportion: organization.attributes.fund ? 100 : 0,
                fund: organization.attributes.fund,
                locked: false,
              },
            ]),
          ),
        },
      ]),
    );
  }

  static fromStrapiData(data, chosenOrganization) {
    if (!chosenOrganization) {
      return Proportions.fromStrapiDataWithEqualProportions(data);
    }

    const preChosenProportions = data.map((cause) =>
      cause.attributes.organizations.data.find(
        (organization) => organization.id === chosenOrganization,
      )
        ? 100
        : 0,
    );

    function calculateProportion(isInCause, isChosenOrganization, isFund) {
      if (isInCause) {
        if (isChosenOrganization) return 100;
        return 0;
      }

      if (isFund) return 100;
      return 0;
    }

    return new Proportions(
      data.map((cause, causeIndex) => [
        cause.id,
        {
          proportion: preChosenProportions[causeIndex],
          locked: false,
          toFund: preChosenProportions[causeIndex] === 100 ? false : true,
          proportions: new Proportions(
            cause.attributes.organizations.data.map((organization) => [
              organization.id,
              {
                proportion: calculateProportion(
                  preChosenProportions[causeIndex] === 100,
                  organization.id === chosenOrganization,
                  organization.attributes.fund,
                ),
                fund: organization.attributes.fund,
                locked: false,
              },
            ]),
          ),
        },
      ]),
    );
  }
}
