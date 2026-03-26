export default {
  routes: [
    {
      method: "GET",
      path: "/dashboard/stats",
      handler: "dashboard.stats",
      config: {},
    },
    {
      method: "GET",
      path: "/dashboard/charts",
      handler: "dashboard.charts",
      config: {},
    },
  ],
};
