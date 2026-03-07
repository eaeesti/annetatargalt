import { DonorsRepository } from "../../../../db/repositories/donors.repository";
import { RecurringDonationsRepository } from "../../../../db/repositories/recurring-donations.repository";

interface DonorInput {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  idCode?: string | null;
}

// Knex connection type for raw queries on the Strapi DB
interface KnexConnection {
  raw: (sql: string) => Promise<{ rows: Array<Record<string, string>> }>;
}

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

  async findOrCreateDonor(donor: DonorInput) {
    const donorEntry = await this.findDonor(donor.idCode ?? "");

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

  async findOrCreateDonorByEmail(donor: DonorInput) {
    const donorEntry = await this.findDonorByEmail(donor.email);

    if (donorEntry) return donorEntry;

    return donorsRepo.create({
      firstName: donor.firstName,
      lastName: donor.lastName,
      email: donor.email,
    });
  },

  async updateOrCreateDonor(donor: DonorInput) {
    const donorEntry = donor.idCode
      ? await this.findOrCreateDonor(donor)
      : await this.findOrCreateDonorByEmail(donor);

    return donorsRepo.update(donorEntry.id, {
      firstName: donor.firstName,
      lastName: donor.lastName,
      email: donor.email,
      idCode: donorEntry.idCode || donor.idCode,
    });
  },

  async updateOrCreateDonorByEmail(donor: DonorInput) {
    const donorEntry = await this.findOrCreateDonorByEmail(donor);

    return donorsRepo.update(donorEntry.id, {
      firstName: donor.firstName,
      lastName: donor.lastName,
    });
  },

  async donorsWithFinalizedDonationCount() {
    const connection = (strapi.db as unknown as { connection: KnexConnection }).connection;
    const result = await connection.raw(
      `SELECT COUNT(DISTINCT donations_donor_links.donor_id)
       FROM donations
       JOIN donations_donor_links ON donations.id = donations_donor_links.donation_id
       JOIN donors ON donations_donor_links.donor_id = donors.id
       WHERE donations.finalized = true`
    );
    return Number(result.rows[0]?.count);
  },
});
