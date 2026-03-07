import { resizeOrganizationDonations } from "../../../../utils/donation";
import { organizationDonationsRepository } from "../../../../db/repositories";

export default ({ strapi }: any) => ({
  async createOrganizationDonations({ donationId, amounts }: any) {
    const organizationDonationsData = await Promise.all(
      amounts.map(async ({ organizationId, amount }: any) => {
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
  }: any) {
    const donationMultiplier = donationAmount / recurringDonationAmount;

    const resizedOrganizationDonations = resizeOrganizationDonations(
      organizationRecurringDonations,
      donationMultiplier,
      donationAmount
    );

    const organizationDonationsData = resizedOrganizationDonations.map(
      (orgDonation: any) => ({
        donationId,
        organizationInternalId: orgDonation.organizationInternalId,
        amount: orgDonation.amount,
      })
    );

    return organizationDonationsRepository.createMany(organizationDonationsData);
  },

  async createFromArray({ donationId, organizationDonations }: any) {
    const organizationDonationsData = await Promise.all(
      organizationDonations.map(async (organizationDonation: any) => {
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
