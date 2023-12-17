"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const { amountsFromProportions } = require("../../../utils/donation");

module.exports = createCoreService(
  "api::organization-donation.organization-donation",
  ({ strapi }) => ({
    async createFromProportions({ donationId, donationAmount, proportions }) {
      const amountsAndProportions = amountsFromProportions(
        proportions,
        donationAmount
      );

      Promise.all(
        Object.entries(amountsAndProportions).map(
          async ([organizationId, amountAndProportion]) => {
            await strapi.entityService.create(
              "api::organization-donation.organization-donation",
              {
                data: {
                  donation: donationId,
                  organization: organizationId,
                  amount: amountAndProportion.amount,
                  proportion: amountAndProportion.proportion,
                },
              }
            );
          }
        )
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
  })
);
