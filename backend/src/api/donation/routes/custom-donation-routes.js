module.exports = {
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
        policies: [],
        auth: false, // TODO: Add admin auth
      },
    },
    {
      method: "GET",
      path: "/export",
      handler: "donation.export",
      config: {
        policies: [],
        auth: false, // TODO: Add admin auth
      },
    },
    {
      method: "POST",
      path: "/deleteAll",
      handler: "donation.deleteAll",
      config: {
        policies: [],
        auth: false, // TODO: Add admin auth
      },
    },
    {
      method: "GET",
      path: "/findTransaction",
      handler: "donation.findTransaction",
      config: {
        policies: [],
        auth: false, // TODO: Add admin auth
      },
    },
    {
      method: "POST",
      path: "/insertTransaction",
      handler: "donation.insertTransaction",
      config: {
        policies: [],
        auth: false, // TODO: Add admin auth
      },
    },
    {
      method: "POST",
      path: "/insertDonation",
      handler: "donation.insertDonation",
      config: {
        policies: [],
        auth: false, // TODO: Add admin auth
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
        policies: [],
        auth: false, // TODO: Add admin auth
      },
    },
    {
      method: "PUT",
      path: "/addDonationsToTransferByDate",
      handler: "donation.addDonationsToTransferByDate",
      config: {
        policies: [],
        auth: false, // TODO: Add admin auth
      },
    },
  ],
};
