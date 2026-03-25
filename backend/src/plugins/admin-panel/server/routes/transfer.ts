export default {
  routes: [
    {
      method: "GET",
      path: "/transfers/list",
      handler: "transfer.list",
      config: {},
    },
    {
      method: "GET",
      path: "/transfers/:id",
      handler: "transfer.findOne",
      config: {},
    },
  ],
};
