export default {
  routes: [
    {
      method: "GET",
      path: "/bank-transactions/list",
      handler: "bankTransaction.list",
      config: {},
    },
    {
      method: "GET",
      path: "/bank-transactions/summary",
      handler: "bankTransaction.summary",
      config: {},
    },
    {
      method: "GET",
      path: "/bank-transactions/:code",
      handler: "bankTransaction.findOne",
      config: {},
    },
    {
      method: "PATCH",
      path: "/bank-transactions/:code",
      handler: "bankTransaction.update",
      config: {},
    },
  ],
};
