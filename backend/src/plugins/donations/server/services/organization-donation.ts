import type { Core } from "@strapi/strapi";
import { resizeOrganizationDonations } from "../../../../utils/donation";
import { organizationDonationsRepository } from "../../../../db/repositories";
import type { OrganizationRecurringDonation } from "../../../../db/schema";

interface AmountEntry {
  organizationId: string;
  amount: number;
}

interface OrganizationDonationArrayEntry {
  organization: string;
  amount: number;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async createOrganizationDonations({ donationId, amounts }: { donationId: number; amounts: AmountEntry[] }) {
    const organizationDonationsData = await Promise.all(
      amounts.map(async ({ organizationId, amount }) => {
        const organization = await strapi
          .documents("api::organization.organization")
          .findOne({
            documentId: organizationId,
            fields: ["internalId"],
          });

        if (!organization || !organization.internalId) {
          throw new Error(
            `Organization ${organizationId} not found or missing internalId`
          );
        }

        return {
          donationId,
          organizationInternalId: organization.internalId,
          amount,
        };
      })
    );

    return organizationDonationsRepository.createMany(organizationDonationsData);
  },

  async createFromOrganizationRecurringDonations({
    donationId,
    donationAmount,
    recurringDonationAmount,
    organizationRecurringDonations,
  }: {
    donationId: number;
    donationAmount: number;
    recurringDonationAmount: number;
    organizationRecurringDonations: OrganizationRecurringDonation[];
  }) {
    const donationMultiplier = donationAmount / recurringDonationAmount;

    const resizedOrganizationDonations = resizeOrganizationDonations(
      organizationRecurringDonations,
      donationMultiplier,
      donationAmount
    );

    const organizationDonationsData = resizedOrganizationDonations.map(
      (orgDonation) => ({
        donationId,
        organizationInternalId: orgDonation.organizationInternalId,
        amount: orgDonation.amount,
      })
    );

    return organizationDonationsRepository.createMany(organizationDonationsData);
  },

  async createFromArray({ donationId, organizationDonations }: { donationId: number; organizationDonations: OrganizationDonationArrayEntry[] }) {
    const organizationDonationsData = await Promise.all(
      organizationDonations.map(async (organizationDonation) => {
        const organization = await strapi
          .documents("api::organization.organization")
          .findOne({
            documentId: organizationDonation.organization,
            fields: ["internalId"],
          });

        if (!organization || !organization.internalId) {
          throw new Error(
            `Organization ${organizationDonation.organization} not found or missing internalId`
          );
        }

        return {
          donationId,
          organizationInternalId: organization.internalId,
          amount: organizationDonation.amount,
        };
      })
    );

    return organizationDonationsRepository.createMany(organizationDonationsData);
  },
});
