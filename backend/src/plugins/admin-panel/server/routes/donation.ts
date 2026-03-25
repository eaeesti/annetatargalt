export default {
  routes: [
    {
      method: "GET",
      path: "/donations/list",
      handler: "donation.list",
      config: {},
    },
  ],
};
