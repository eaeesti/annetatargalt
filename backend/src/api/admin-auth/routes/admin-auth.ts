export default {
  routes: [
    {
      method: "POST",
      path: "/admin-auth/login",
      handler: "admin-auth.login",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
