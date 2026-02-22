"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const {
  organizationRecurringDonationsRepository,
} = require("../../../db/repositories");

module.exports = createCoreService(
  "api::organization-recurring-donation.organization-recurring-donation",
  ({ strapi }) => ({
    async createOrganizationDonations({ recurringDonationId, amounts }) {
      // Convert organization IDs to internalIds and create organization recurring donations
      const organizationRecurringDonationsData = await Promise.all(
        amounts.map(async ({ organizationId, amount }) => {
          const organization = await strapi.entityService.findOne(
            "api::organization.organization",
            organizationId,
            { fields: ["internalId"] }
          );

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

      // Create organization recurring donations in Drizzle
      return organizationRecurringDonationsRepository.createMany(
        organizationRecurringDonationsData
      );
    },
  })
);
