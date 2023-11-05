module.exports = {
  routes: [
    {
      method: "POST",
      path: "/donate",
      handler: "donation.donate",
    },
  ],
};
