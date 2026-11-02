import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Core } from "@strapi/strapi";
import serviceFactory from "../donation";

const findMany = vi.fn();
const service = serviceFactory({
  // The validation reads only the organizations from Strapi.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  strapi: { documents: () => ({ findMany }) } as unknown as Core.Strapi,
});

function donation(
  amounts: { organizationInternalId: string; amount: number }[],
) {
  return {
    firstName: "Test",
    lastName: "Donor",
    email: "test@example.org",
    amount: amounts.reduce((sum, { amount }) => sum + amount, 0),
    type: "onetime",
    paymentMethod: "paymentInitiation",
    amounts,
  };
}

describe("validateDonation's organizations", () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([
      { id: 1, internalId: "org-a", active: true },
      { id: 2, internalId: "org-b", active: true },
      { id: 3, internalId: "org-c", active: false },
    ]);
  });

  it("checks all of a donation's organizations in one query", async () => {
    const result = await service.validateDonation(
      donation([
        { organizationInternalId: "org-a", amount: 1000 },
        { organizationInternalId: "org-b", amount: 500 },
      ]),
    );

    expect(result).toEqual({ valid: true });
    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      filters: { internalId: { $in: ["org-a", "org-b"] } },
    });
  });

  it("refuses an organization that isn't active, or doesn't exist", async () => {
    for (const internalId of ["org-c", "org-x"]) {
      const result = await service.validateDonation(
        donation([
          { organizationInternalId: "org-a", amount: 1000 },
          { organizationInternalId: internalId, amount: 500 },
        ]),
      );
      expect(result).toEqual({
        valid: false,
        reason: `Not a valid organization: ${internalId}`,
      });
    }
  });

  it("refuses a list longer than the form could send, before asking Strapi", async () => {
    const result = await service.validateDonation(
      donation(
        Array.from({ length: 51 }, () => ({
          organizationInternalId: "org-a",
          amount: 100,
        })),
      ),
    );

    expect(result).toEqual({
      valid: false,
      reason: "Invalid organization amounts",
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});
