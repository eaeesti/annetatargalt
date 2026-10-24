export default {
  routes: [
    {
      method: "POST",
      path: "/bank-transactions/:code/files",
      handler: "bankTransactionFile.upload",
      config: {},
    },
    {
      method: "GET",
      path: "/bank-transaction-files/:id",
      handler: "bankTransactionFile.download",
      config: {},
    },
    {
      method: "DELETE",
      path: "/bank-transaction-files/:id",
      handler: "bankTransactionFile.remove",
      config: {},
    },
  ],
};
