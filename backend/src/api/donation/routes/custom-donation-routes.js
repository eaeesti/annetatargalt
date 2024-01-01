module.exports = {
  routes: [
    {
      method: "POST",
      path: "/donate",
      handler: "donation.donate",
    },
    {
      method: "POST",
      path: "/confirm",
      handler: "donation.confirm",
    },
    {
      method: "GET",
      path: "/decode",
      handler: "donation.decode",
    },
    {
      method: "POST",
      path: "/donations/import",
      handler: "donation.import",
    },
    {
      method: "GET",
      path: "/donations/export",
      handler: "donation.export",
    },
    {
      method: "POST",
      path: "/donations/deleteAll",
      handler: "donation.deleteAll",
    },
    {
      method: "GET",
      path: "/donations/findTransaction",
      handler: "donation.findTransaction",
    },
    {
      method: "POST",
      path: "/donations/insertTransaction",
      handler: "donation.insertTransaction",
    },
    {
      method: "POST",
      path: "/donations/insertDonation",
      handler: "donation.insertDonation",
    },
    {
      method: "GET",
      path: "/stats",
      handler: "donation.stats",
    },
  ],
};
