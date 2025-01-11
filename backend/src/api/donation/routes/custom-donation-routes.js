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
      path: "/donation/import",
      handler: "donation.import",
    },
    {
      method: "GET",
      path: "/donation/export",
      handler: "donation.export",
    },
    {
      method: "POST",
      path: "/donation/deleteAll",
      handler: "donation.deleteAll",
    },
    {
      method: "GET",
      path: "/donation/findTransaction",
      handler: "donation.findTransaction",
    },
    {
      method: "POST",
      path: "/donation/insertTransaction",
      handler: "donation.insertTransaction",
    },
    {
      method: "POST",
      path: "/donation/insertDonation",
      handler: "donation.insertDonation",
    },
    {
      method: "GET",
      path: "/stats",
      handler: "donation.stats",
    },
  ],
};
