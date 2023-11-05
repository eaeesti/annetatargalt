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
  ],
};
