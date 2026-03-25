import donation from "./donation";
import donor from "./donor";

export default {
  "donation-router": {
    type: "content-api",
    routes: donation.routes,
  },
  "donor-router": {
    type: "content-api",
    routes: donor.routes,
  },
};
