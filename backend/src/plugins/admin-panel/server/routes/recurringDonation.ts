export default {
  routes: [
    {
      method: "GET",
      path: "/recurring-donations/list",
      handler: "recurringDonation.list",
      config: {},
    },
    {
      method: "GET",
      path: "/recurring-donations/grid",
      handler: "recurringDonation.grid",
      config: {},
    },
    {
      method: "GET",
      path: "/recurring-donations/:id",
      handler: "recurringDonation.findOne",
      config: {},
    },
  ],
};
