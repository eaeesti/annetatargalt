"use strict";

const { donorsRepository, DonorsRepository } = require("./donors.repository");
const {
  donationsRepository,
  DonationsRepository,
} = require("./donations.repository");
const {
  recurringDonationsRepository,
  RecurringDonationsRepository,
} = require("./recurring-donations.repository");
const {
  organizationDonationsRepository,
  OrganizationDonationsRepository,
} = require("./organization-donations.repository");
const {
  organizationRecurringDonationsRepository,
  OrganizationRecurringDonationsRepository,
} = require("./organization-recurring-donations.repository");
const {
  donationTransfersRepository,
  DonationTransfersRepository,
} = require("./donation-transfers.repository");

module.exports = {
  donorsRepository,
  DonorsRepository,
  donationsRepository,
  DonationsRepository,
  recurringDonationsRepository,
  RecurringDonationsRepository,
  organizationDonationsRepository,
  OrganizationDonationsRepository,
  organizationRecurringDonationsRepository,
  OrganizationRecurringDonationsRepository,
  donationTransfersRepository,
  DonationTransfersRepository,
};
