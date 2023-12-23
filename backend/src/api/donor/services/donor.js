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

    const recurringDonations = await strapi.entityService.findMany(
      "api::recurring-donation.recurring-donation",
      {
        filters: {
          companyCode: idCode,
        },
        populate: ["donor"],
        sort: "datetime:desc",
        limit: 1,
      }
    );

    if (recurringDonations.length > 0) {
      return recurringDonations[0].donor;
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

  async donorsWithFinalizedDonationCount() {
    const result = await strapi.db.connection.raw(
      `SELECT COUNT(DISTINCT donations_donor_links.donor_id) 
       FROM donations 
       JOIN donations_donor_links ON donations.id = donations_donor_links.donation_id 
       JOIN donors ON donations_donor_links.donor_id = donors.id 
       WHERE donations.finalized = true`
    );
    const count = Number(result.rows[0].count);
    return count;
  },
}));
