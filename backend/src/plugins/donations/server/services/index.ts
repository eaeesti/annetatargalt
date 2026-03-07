import donation from "./donation";
import donor from "./donor";
import organizationDonation from "./organization-donation";
import organizationRecurringDonation from "./organization-recurring-donation";

export default {
  donation,
  donor,
  "organization-donation": organizationDonation,
  "organization-recurring-donation": organizationRecurringDonation,
};
