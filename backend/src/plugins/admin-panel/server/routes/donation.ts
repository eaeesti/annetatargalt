export default {
  routes: [
    {
      method: "GET",
      path: "/donations/list",
      handler: "donation.list",
      config: {},
    },
    {
      method: "GET",
      path: "/donations/:id",
      handler: "donation.findOne",
      config: {},
    },
  ],
};
