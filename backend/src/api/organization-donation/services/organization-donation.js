"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const { amountsFromProportions } = require("../../../utils/donation");

module.exports = createCoreService(
  "api::organization-donation.organization-donation",
  ({ strapi }) => ({
    async createFromProportions(donation, proportions) {
      const amountsAndProportions = amountsFromProportions(
        proportions,
        donation.amount
      );

      Promise.all(
        Object.entries(amountsAndProportions).map(
          async ([organizationId, amountAndProportion]) => {
            await strapi.entityService.create(
              "api::organization-donation.organization-donation",
              {
                data: {
                  donation: donation.id,
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
