"use strict";

/**
 * donor service
 */

const { createCoreService } = require("@strapi/strapi").factories;
const {
  DonorsRepository,
} = require("../../../db/repositories/donors.repository");
const {
  RecurringDonationsRepository,
} = require("../../../db/repositories/recurring-donations.repository");

const donorsRepo = new DonorsRepository();
const recurringDonationsRepo = new RecurringDonationsRepository();

module.exports = createCoreService("api::donor.donor", ({ strapi }) => ({
  async findDonor(idCode) {
    // First, try to find donor by ID code in Drizzle
    const existingDonor = await donorsRepo.findByIdCode(idCode);

    if (existingDonor) {
      return existingDonor;
    }

    // Fallback: check if recurring donation with this company code exists
    const recurringDonation = await recurringDonationsRepo.findByCompanyCode(
      idCode
    );

    if (recurringDonation) {
      // Fetch the donor associated with this recurring donation
      return donorsRepo.findById(recurringDonation.donorId);
    }

    return null;
  },

  async findDonorByEmail(email) {
    return donorsRepo.findByEmail(email);
  },

  async findOrCreateDonor(donor) {
    const donorEntry = await this.findDonor(donor.idCode);

    if (donorEntry) {
      return donorEntry;
    }

    const newDonorEntry = await donorsRepo.create({
      firstName: donor.firstName,
      lastName: donor.lastName,
      email: donor.email,
      idCode: donor.idCode,
    });

    return newDonorEntry;
  },

  async findOrCreateDonorByEmail(donor) {
    const donorEntry = await this.findDonorByEmail(donor.email);

    if (donorEntry) return donorEntry;

    const newDonorEntry = await donorsRepo.create({
      firstName: donor.firstName,
      lastName: donor.lastName,
      email: donor.email,
    });

    return newDonorEntry;
  },

  async updateOrCreateDonor(donor) {
    let donorEntry;

    if (donor.idCode) {
      donorEntry = await this.findOrCreateDonor(donor);
    } else {
      donorEntry = await this.findOrCreateDonorByEmail(donor);
    }

    const updatedDonor = await donorsRepo.update(donorEntry.id, {
      firstName: donor.firstName,
      lastName: donor.lastName,
      email: donor.email,
      idCode: donorEntry.idCode || donor.idCode,
    });

    return updatedDonor;
  },

  async updateOrCreateDonorByEmail(donor) {
    const donorEntry = await this.findOrCreateDonorByEmail(donor);

    const updatedDonor = await donorsRepo.update(donorEntry.id, {
      firstName: donor.firstName,
      lastName: donor.lastName,
    });

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
