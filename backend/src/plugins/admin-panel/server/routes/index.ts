import donation from "./donation";
import donor from "./donor";
import recurringDonation from "./recurringDonation";
import transfer from "./transfer";
import organization from "./organization";
import dashboard from "./dashboard";

export default {
  "donation-router": {
    type: "content-api",
    routes: donation.routes,
  },
  "donor-router": {
    type: "content-api",
    routes: donor.routes,
  },
  "recurring-donation-router": {
    type: "content-api",
    routes: recurringDonation.routes,
  },
  "transfer-router": {
    type: "content-api",
    routes: transfer.routes,
  },
  "organization-router": {
    type: "content-api",
    routes: organization.routes,
  },
  "dashboard-router": {
    type: "content-api",
    routes: dashboard.routes,
  },
};
