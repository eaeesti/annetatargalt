"use strict";

const donation = require("./donation");
const donor = require("./donor");
const organizationDonation = require("./organization-donation");
const organizationRecurringDonation = require("./organization-recurring-donation");

module.exports = {
  donation,
  donor,
  "organization-donation": organizationDonation,
  "organization-recurring-donation": organizationRecurringDonation,
};
