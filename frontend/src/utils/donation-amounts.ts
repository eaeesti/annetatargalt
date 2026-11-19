import type Proportions from "./proportions";
import type { CauseData } from "./proportions";
import type { StrapiCause, StrapiOrganization } from "@/types/generated/strapi";

/**
 * Support for the platform, chosen like a cause: its share of the donation
 * goes to the platform's own organization (the site's tip organization).
 */
export const SUPPORT_KEY = "support";

/**
 * What a donation is split between: the causes, and support for the platform
 * when the site names an organization for it, last.
 */
export function splitChoices(
  causes: { data: CauseData[] },
  supportOrganization: string | null,
): { data: CauseData[] } {
  if (!supportOrganization) return causes;
  return {
    data: [
      ...causes.data,
      {
        id: SUPPORT_KEY,
        organizations: [{ internalId: supportOrganization, fund: true }],
      },
    ],
  };
}

/** Support's share of the donation, in percent: 0 when it isn't chosen. */
export function supportShare(proportions: Proportions): number {
  return proportions.keys().includes(SUPPORT_KEY)
    ? proportions.getProportion(SUPPORT_KEY)
    : 0;
}

export interface CauseAmount {
  cause: StrapiCause;
  /** 0 for a cause that isn't chosen. */
  amount: number;
  /** The organizations it goes to, each with its part; none if not chosen. */
  organizations: { organization: StrapiOrganization; amount: number }[];
}

/**
 * What each cause, and each of its organizations, gets of the donation, and
 * what support for the platform gets: the same calculation as the donation
 * itself, so the form shows what is paid.
 */
export function amountsByCause(
  proportions: Proportions,
  amount: number,
  causes: { data: StrapiCause[] },
  supportOrganization: string | null,
): { causes: CauseAmount[]; support: number } {
  const amounts = proportions.calculateAmounts(
    amount,
    splitChoices(causes, supportOrganization),
  );
  const amountFor = (internalId: string | null) =>
    amounts.find(
      ({ organizationInternalId }) => organizationInternalId === internalId,
    )?.amount ?? 0;

  return {
    causes: causes.data.map((cause) => {
      const organizations = cause.organizations
        .map((organization) => ({
          organization,
          amount: amountFor(organization.internalId),
        }))
        .filter((organization) => organization.amount > 0);
      return {
        cause,
        organizations,
        amount: organizations.reduce((sum, { amount }) => sum + amount, 0),
      };
    }),
    support: supportOrganization ? amountFor(supportOrganization) : 0,
  };
}
