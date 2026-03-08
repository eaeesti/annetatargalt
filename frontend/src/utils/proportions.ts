
type ProportionKey = string | number;

interface ProportionEntry {
  locked: boolean;
  proportion: number;
  toFund?: boolean;
  fund?: boolean | null;
  proportions?: Proportions;
}

interface CauseData {
  id: number;
  organizations: OrganizationData[];
}

interface OrganizationData {
  internalId: string | null;
  fund?: boolean | null;
}

interface AmountEntry {
  organizationInternalId: string;
  amount: number;
}

export default class Proportions {
  proportions: Map<ProportionKey, ProportionEntry>;

  constructor(entries: Array<[ProportionKey, Partial<ProportionEntry>]>) {
    const preparedEntries = entries.map(([key, value]) => [
      key,
      {
        locked: false,
        proportion: Math.floor(100 / entries.length),
        ...value,
      },
    ]) as Array<[ProportionKey, ProportionEntry]>;
    this.proportions = new Map(preparedEntries);
  }

  get(id: ProportionKey): ProportionEntry {
    return this.proportions.get(id)!;
  }

  getSub(id: ProportionKey, subId: ProportionKey): ProportionEntry {
    return this.proportions.get(id)!.proportions!.get(subId);
  }

  set(id: ProportionKey, value: ProportionEntry): void {
    this.proportions.set(id, value);
  }

  setSub(id: ProportionKey, subId: ProportionKey, value: ProportionEntry): void {
    this.proportions.get(id)!.proportions!.set(subId, value);
  }

  getProportion(id: ProportionKey): number {
    return this.proportions.get(id)!.proportion;
  }

  getSubProportion(id: ProportionKey, subId: ProportionKey): number {
    return this.getSub(id, subId).proportion;
  }

  goesToFund(id: ProportionKey): boolean | undefined {
    return this.proportions.get(id)!.toFund;
  }

  toggleToFund(id: ProportionKey): Proportions {
    let newProportions: Proportions = this;

    if (!this.goesToFund(id)) {
      const fundId = this.subKeys(id).find(
        (subId) => this.getSub(id, subId).fund,
      );
      newProportions = newProportions
        .unlockSubProportions(id)
        .updateSubProportion(id, fundId!, 100)
        .unlockSubProportions(id);
    }

    return newProportions.mapEntries((key, value) => [
      key,
      key === id ? { ...value, toFund: !value.toFund } : value,
    ]);
  }

  isLocked(id: ProportionKey): boolean {
    return this.proportions.get(id)!.locked;
  }

  isSubLocked(id: ProportionKey, subId: ProportionKey): boolean {
    return this.getSub(id, subId).locked;
  }

  keys(): ProportionKey[] {
    return Array.from(this.proportions.keys());
  }

  subKeys(id: ProportionKey): ProportionKey[] {
    return Array.from(this.get(id).proportions!.keys());
  }

  entries(): Array<[ProportionKey, ProportionEntry]> {
    return Array.from(this.proportions.entries());
  }

  mapEntries(
    fun: (key: ProportionKey, value: ProportionEntry) => [ProportionKey, ProportionEntry],
  ): Proportions {
    return new Proportions(
      this.entries().map(([key, value]) => fun(key, value)),
    );
  }

  proportionSum(): number {
    return Array.from(this.proportions.values()).reduce(
      (sum, { proportion }) => sum + proportion,
      0,
    );
  }

  lockProportion(id: ProportionKey): Proportions {
    return this.mapEntries((key, value) => [
      key,
      key === id ? { ...value, locked: true } : value,
    ]);
  }

  lockSubProportion(id: ProportionKey, subId: ProportionKey): Proportions {
    return this.mapEntries((key, value) => [
      key,
      key === id
        ? {
            ...value,
            proportions: value.proportions!.lockProportion(subId),
          }
        : value,
    ]);
  }

  toggleProportionLock(id: ProportionKey): Proportions {
    return this.mapEntries((key, value) => [
      key,
      key === id ? { ...value, locked: !value.locked } : value,
    ]);
  }

  toggleSubProportionLock(id: ProportionKey, subId: ProportionKey): Proportions {
    return this.mapEntries((key, value) => [
      key,
      key === id
        ? {
            ...value,
            proportions: value.proportions!.toggleProportionLock(subId),
          }
        : value,
    ]);
  }

  unlockProportions(): Proportions {
    return this.mapEntries((key, value) => [key, { ...value, locked: false }]);
  }

  unlockSubProportions(id: ProportionKey): Proportions {
    return this.mapEntries((key, value) => [
      key,
      key === id
        ? { ...value, proportions: value.proportions!.unlockProportions() }
        : value,
    ]);
  }

  updateProportion(id: ProportionKey, proportion: number): Proportions {
    const newProportions = new Proportions(this.entries());

    const lockedProportions: ProportionKey[] = [];
    const unlockedProportions: ProportionKey[] = [];
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

    let newProportion: number;
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
      let proportionsToChange: ProportionKey[];
      proportionsToChange = unlockedProportions.filter(
        (prop) => newProportions.getProportion(prop) > 0,
      );
      if (proportionsToChange.length === 0 && adder >= 0)
        proportionsToChange = unlockedProportions;
      let proportionToChangeIndex =
        (totalUnlocked - (adder < 0 ? 1 : 0)) % proportionsToChange.length;
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

  updateSubProportion(id: ProportionKey, subId: ProportionKey, proportion: number): Proportions {
    return this.mapEntries((key, value) => [
      key,
      key === id
        ? {
            ...value,
            proportions: value.proportions!.updateProportion(subId, proportion),
          }
        : value,
    ]);
  }

  toJSON(): Record<string, { proportion: number; proportions?: Proportions }> {
    return Object.fromEntries(
      this.entries()
        .map(([key, value]) => [
          key,
          { proportion: value.proportion, proportions: value.proportions },
        ])
        .filter(([_, value]) => (value as { proportion: number }).proportion > 0),
    );
  }

  calculateAmounts(totalAmount: number, causes: { data: CauseData[] }): AmountEntry[] {
    const amounts: AmountEntry[] = [];

    causes.data.forEach((cause) => {
      const causeProportion = this.getProportion(cause.id);
      cause.organizations.forEach((organization) => {
        const organizationProportion = this.getSubProportion(
          cause.id,
          organization.internalId!,
        );
        const proportion = (causeProportion * organizationProportion) / 10000;
        const amount = totalAmount * proportion;
        const roundedAmount = Math.round(amount * 100) / 100;
        if (roundedAmount > 0) {
          amounts.push({
            organizationInternalId: organization.internalId!,
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

  static fromStrapiDataWithEqualProportions(data: CauseData[]): Proportions {
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
            cause.organizations.map((organization) => [
              organization.internalId!,
              {
                proportion: organization.fund ? 100 : 0,
                fund: organization.fund,
                locked: false,
              },
            ]),
          ),
        },
      ]),
    );
  }

  static fromStrapiData(data: CauseData[], chosenOrganizationInternalId?: string): Proportions {
    if (!chosenOrganizationInternalId) {
      return Proportions.fromStrapiDataWithEqualProportions(data);
    }

    // Check if organization exists
    const organizationExists = data.some((cause) =>
      cause.organizations.some(
        (organization) => organization.internalId === chosenOrganizationInternalId,
      ),
    );

    if (!organizationExists) {
      // Organization not found, fall back to equal proportions
      return Proportions.fromStrapiDataWithEqualProportions(data);
    }

    const preChosenProportions = data.map((cause) =>
      cause.organizations.find(
        (organization) => organization.internalId === chosenOrganizationInternalId,
      )
        ? 100
        : 0,
    );

    function calculateProportion(isInCause: boolean, isChosenOrganization: boolean, isFund: boolean | null | undefined): number {
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
            cause.organizations.map((organization) => [
              organization.internalId!,
              {
                proportion: calculateProportion(
                  preChosenProportions[causeIndex] === 100,
                  organization.internalId === chosenOrganizationInternalId,
                  organization.fund,
                ),
                fund: organization.fund,
                locked: false,
              },
            ]),
          ),
        },
      ]),
    );
  }
}
