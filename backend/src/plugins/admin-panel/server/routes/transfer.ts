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
      path: "/transfers/preview",
      handler: "transfer.preview",
      config: {},
    },
    {
      method: "GET",
      path: "/transfers/unlinked-outgoing",
      handler: "transfer.unlinkedOutgoing",
      config: {},
    },
    {
      method: "POST",
      path: "/transfers",
      handler: "transfer.create",
      config: {},
    },
    {
      method: "GET",
      path: "/transfers/:id",
      handler: "transfer.findOne",
      config: {},
    },
    {
      method: "PATCH",
      path: "/transfers/:id",
      handler: "transfer.update",
      config: {},
    },
    {
      method: "DELETE",
      path: "/transfers/:id",
      handler: "transfer.remove",
      config: {},
    },
  ],
};
