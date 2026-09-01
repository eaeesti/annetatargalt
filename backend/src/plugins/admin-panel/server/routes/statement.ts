export default {
  routes: [
    {
      method: "POST",
      path: "/statement/preview",
      handler: "statement.preview",
      config: {},
    },
    {
      method: "POST",
      path: "/statement/apply",
      handler: "statement.apply",
      config: {},
    },
  ],
};
