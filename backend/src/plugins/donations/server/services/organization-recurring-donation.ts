import type { Core } from "@strapi/strapi";
import { organizationRecurringDonationsRepository } from "../../../../db/repositories";

interface AmountEntry {
  organizationId: string;
  amount: number;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async createOrganizationDonations({ recurringDonationId, amounts }: { recurringDonationId: number; amounts: AmountEntry[] }) {
    const organizationRecurringDonationsData = await Promise.all(
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
