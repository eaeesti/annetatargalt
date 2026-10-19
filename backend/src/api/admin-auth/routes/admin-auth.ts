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
    {
      method: "POST",
      path: "/admin-auth/google",
      handler: "admin-auth.google",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
