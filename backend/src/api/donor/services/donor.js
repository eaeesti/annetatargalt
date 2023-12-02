"use strict";

/**
 * donor service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::donor.donor", ({ strapi }) => ({
  async findDonor(idCode) {
    const existingDonorEntries = await strapi.entityService.findMany(
      "api::donor.donor",
      { filters: { idCode: idCode } }
    );

    if (existingDonorEntries.length > 0) {
      return existingDonorEntries[0];
    }

    return null;
  },

  async findOrCreateDonor(donor) {
    const donorEntry = await this.findDonor(donor.idCode);

    if (donorEntry) {
      return donorEntry;
    }

    const newDonorEntry = await strapi.entityService.create(
      "api::donor.donor",
      {
        data: {
          firstName: donor.firstName,
          lastName: donor.lastName,
          email: donor.email,
          idCode: donor.idCode,
        },
      }
    );

    return newDonorEntry;
  },

  async updateOrCreateDonor(donor) {
    const donorEntry = await this.findOrCreateDonor(donor);

    const updatedDonor = await strapi.entityService.update(
      "api::donor.donor",
      donorEntry.id,
      {
        data: {
          firstName: donor.firstName,
          lastName: donor.lastName,
          email: donor.email,
        },
      }
    );

    return updatedDonor;
  },
}));
