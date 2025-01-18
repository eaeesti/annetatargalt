"use strict";

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService(
  "api::organization-recurring-donation.organization-recurring-donation",
  ({ strapi }) => ({
    async createOrganizationDonations({ recurringDonationId, amounts }) {
      return Promise.all(
        amounts.map(async ({ organizationId, amount }) => {
          await strapi.entityService.create(
            "api::organization-recurring-donation.organization-recurring-donation",
            {
              data: {
                recurringDonation: recurringDonationId,
                organization: organizationId,
                amount,
              },
            }
          );
        })
      );
    },
  })
);
