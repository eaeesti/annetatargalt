"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const { amountsFromProportions } = require("../../../utils/donation");

module.exports = createCoreService(
  "api::organization-donation.organization-donation",
  ({ strapi }) => ({
    async createOrganizationDonations({ donationId, amounts }) {
      return Promise.all(
        amounts.map(async ({ organizationId, amount }) => {
          await strapi.entityService.create(
            "api::organization-donation.organization-donation",
            {
              data: {
                donation: donationId,
                organization: organizationId,
                amount,
              },
            }
          );
        })
      );
    },

    async createFromOrganizationRecurringDonations({
      donationId,
      donationAmount,
      organizationRecurringDonations,
    }) {
      Promise.all(
        organizationRecurringDonations.map(
          async (organizationRecurringDonation) => {
            const amount = Math.round(
              donationAmount * organizationRecurringDonation.proportion
            );

            await strapi.entityService.create(
              "api::organization-donation.organization-donation",
              {
                data: {
                  donation: donationId,
                  organization: organizationRecurringDonation.organization.id,
                  proportion: organizationRecurringDonation.proportion,
                  amount,
                },
              }
            );
          }
        )
      );
    },

    async createFromArray({
      donationId,
      donationAmount,
      organizationDonations,
    }) {
      Promise.all(
        organizationDonations.map(async (organizationDonation) => {
          const proportion = organizationDonation.amount / donationAmount;

          await strapi.entityService.create(
            "api::organization-donation.organization-donation",
            {
              data: {
                donation: donationId,
                organization: organizationDonation.organization,
                proportion,
                amount: organizationDonation.amount,
              },
            }
          );
        })
      );
    },
  })
);
