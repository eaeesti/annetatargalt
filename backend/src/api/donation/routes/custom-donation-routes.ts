export default {
  routes: [
    // Public routes — no authentication required
    {
      method: "POST",
      path: "/donate",
      handler: "donation.donate",
      config: { auth: false, policies: [] },
    },
    {
      method: "POST",
      path: "/donateExternal",
      handler: "donation.donateExternal",
      config: { auth: false, policies: [] },
    },
    {
      method: "POST",
      path: "/donateForeign",
      handler: "donation.donateForeign",
      config: { auth: false, policies: [] },
    },
    {
      method: "POST",
      path: "/confirm",
      handler: "donation.confirm",
      config: { auth: false, policies: [] },
    },
    {
      method: "GET",
      path: "/decode",
      handler: "donation.decode",
      config: { auth: false, policies: [] },
    },
    {
      method: "GET",
      path: "/stats",
      handler: "donation.stats",
      config: { auth: false, policies: [] },
    },
    // Admin routes — protected by users-permissions roles.
    // Configure which roles can access these in Strapi admin:
    //   Settings → Users & Permissions → Roles → [role] → Donation
    {
      method: "GET",
      path: "/export",
      handler: "donation.export",
      config: {},
    },
    {
      method: "GET",
      path: "/findTransaction",
      handler: "donation.findTransaction",
      config: {},
    },
  ],
};
