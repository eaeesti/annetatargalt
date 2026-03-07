import { DonorsRepository } from "../../../../db/repositories/donors.repository";
import { RecurringDonationsRepository } from "../../../../db/repositories/recurring-donations.repository";

const donorsRepo = new DonorsRepository();
const recurringDonationsRepo = new RecurringDonationsRepository();

export default () => ({
  async findDonor(idCode: string) {
    const existingDonor = await donorsRepo.findByIdCode(idCode);

    if (existingDonor) {
      return existingDonor;
    }

    const recurringDonation = await recurringDonationsRepo.findByCompanyCode(idCode);

    if (recurringDonation) {
      return donorsRepo.findById(recurringDonation.donorId);
    }

    return null;
  },

  async findDonorByEmail(email: string) {
    return donorsRepo.findByEmail(email);
  },

  async findOrCreateDonor(donor: any) {
    const donorEntry = await this.findDonor(donor.idCode);

    if (donorEntry) {
      return donorEntry;
    }

    return donorsRepo.create({
      firstName: donor.firstName,
      lastName: donor.lastName,
      email: donor.email,
      idCode: donor.idCode,
    });
  },

  async findOrCreateDonorByEmail(donor: any) {
    const donorEntry = await this.findDonorByEmail(donor.email);

    if (donorEntry) return donorEntry;

    return donorsRepo.create({
      firstName: donor.firstName,
      lastName: donor.lastName,
      email: donor.email,
    });
  },

  async updateOrCreateDonor(donor: any) {
    let donorEntry: any;

    if (donor.idCode) {
      donorEntry = await this.findOrCreateDonor(donor);
    } else {
      donorEntry = await this.findOrCreateDonorByEmail(donor);
    }

    return donorsRepo.update(donorEntry.id, {
      firstName: donor.firstName,
      lastName: donor.lastName,
      email: donor.email,
      idCode: donorEntry.idCode || donor.idCode,
    });
  },

  async updateOrCreateDonorByEmail(donor: any) {
    const donorEntry = await this.findOrCreateDonorByEmail(donor);

    return donorsRepo.update(donorEntry.id, {
      firstName: donor.firstName,
      lastName: donor.lastName,
    });
  },

  async donorsWithFinalizedDonationCount() {
    const strapi = (global as any).strapi;
    const result = await strapi.db.connection.raw(
      `SELECT COUNT(DISTINCT donations_donor_links.donor_id)
       FROM donations
       JOIN donations_donor_links ON donations.id = donations_donor_links.donation_id
       JOIN donors ON donations_donor_links.donor_id = donors.id
       WHERE donations.finalized = true`
    );
    return Number(result.rows[0].count);
  },
});
