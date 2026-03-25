import donation from "./donation";
import donor from "./donor";
import recurringDonation from "./recurringDonation";

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
};
