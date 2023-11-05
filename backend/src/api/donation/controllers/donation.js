"use strict";

const { amountToCents, validateDonation } = require("../../../utils/donation");

/**
 * donation controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::donation.donation",
  ({ strapi }) => ({
    async donate(ctx) {
      const donation = ctx.request.body;
      const validation = validateDonation(donation);

      if (!validation.valid) {
        return ctx.badRequest(validation.reason);
      }

      const entry = await strapi.entityService.create(
        "api::donation.donation",
        {
          data: {
            firstName: donation.firstName,
            lastName: donation.lastName,
            idCode: donation.idCode,
            amount: amountToCents(donation.amount),
            email: donation.email,
          },
        }
      );

      return ctx.send({ redirectURL: "/annetatud" });
    },
  })
);
