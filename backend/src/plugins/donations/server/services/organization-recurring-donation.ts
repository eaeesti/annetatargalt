import { organizationRecurringDonationsRepository } from "../../../../db/repositories";

export default ({ strapi }: any) => ({
  async createOrganizationDonations({ recurringDonationId, amounts }: any) {
    const organizationRecurringDonationsData = await Promise.all(
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
          recurringDonationId,
          organizationInternalId: organization.internalId,
          amount,
        };
      })
    );

    return organizationRecurringDonationsRepository.createMany(
      organizationRecurringDonationsData
    );
  },
});
