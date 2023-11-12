"use strict";

/**
 * donor service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::donor.donor", ({ strapi }) => ({
  async findOrCreateDonor(donor) {
    const existingDonor = await strapi.db
      .query("api::donor.donor")
      .findOne({ idCode: donor.idCode });

    if (existingDonor) {
      const updatedDonor = await strapi.entityService.update(
        "api::donor.donor",
        existingDonor.id,
        {
          data: {
            firstName: donor.firstName,
            lastName: donor.lastName,
            email: donor.email,
          },
        }
      );
      return updatedDonor;
    }

    const newDonor = await strapi.entityService.create("api::donor.donor", {
      data: {
        firstName: donor.firstName,
        lastName: donor.lastName,
        email: donor.email,
        idCode: donor.idCode,
      },
    });

    return newDonor;
  },
}));
