export default {
  routes: [
    {
      method: "GET",
      path: "/donors/list",
      handler: "donor.list",
      config: {},
    },
    {
      method: "GET",
      path: "/donors/:id",
      handler: "donor.findOne",
      config: {},
    },
    {
      method: "PATCH",
      path: "/donors/:id/email-preferences",
      handler: "donor.updateEmailPreferences",
      config: {},
    },
  ],
};
