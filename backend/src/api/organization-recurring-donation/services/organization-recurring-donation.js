"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const { amountsFromProportions } = require("../../../utils/donation");

module.exports = createCoreService(
  "api::organization-recurring-donation.organization-recurring-donation",
  ({ strapi }) => ({
    async createFromProportions({
      recurringDonationId,
      recurringDonationAmount,
      proportions,
    }) {
      const amountsAndProportions = amountsFromProportions(
        proportions,
        recurringDonationAmount
      );

      Promise.all(
        Object.entries(amountsAndProportions).map(
          async ([organizationId, amountAndProportion]) => {
            await strapi.entityService.create(
              "api::organization-recurring-donation.organization-recurring-donation",
              {
                data: {
                  recurringDonation: recurringDonationId,
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
  })
);
