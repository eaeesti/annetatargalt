export default {
  routes: [
    {
      method: "GET",
      path: "/organizations/stats",
      handler: "organization.stats",
      config: {},
    },
    {
      method: "GET",
      path: "/organizations/:internalId/monthly-totals",
      handler: "organization.monthlyTotals",
      config: {},
    },
  ],
};
