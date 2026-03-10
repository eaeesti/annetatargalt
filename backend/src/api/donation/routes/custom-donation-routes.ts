export default {
  routes: [
    {
      method: "POST",
      path: "/donate",
      handler: "donation.donate",
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/donateExternal",
      handler: "donation.donateExternal",
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/donateForeign",
      handler: "donation.donateForeign",
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/confirm",
      handler: "donation.confirm",
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/decode",
      handler: "donation.decode",
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/import",
      handler: "donation.import",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "GET",
      path: "/export",
      handler: "donation.export",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "POST",
      path: "/deleteAll",
      handler: "donation.deleteAll",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "GET",
      path: "/findTransaction",
      handler: "donation.findTransaction",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "POST",
      path: "/insertTransaction",
      handler: "donation.insertTransaction",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "POST",
      path: "/insertDonation",
      handler: "donation.insertDonation",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "GET",
      path: "/stats",
      handler: "donation.stats",
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/migrateTips",
      handler: "donation.migrateTips",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "GET",
      path: "/donations/list",
      handler: "donation.list",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "PUT",
      path: "/addDonationsToTransferByDate",
      handler: "donation.addDonationsToTransferByDate",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
  ],
};
