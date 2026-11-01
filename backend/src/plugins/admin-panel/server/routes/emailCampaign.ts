// The fixed paths come before "/emails/:id", which would take them as an id.
export default {
  routes: [
    {
      method: "GET",
      path: "/emails/list",
      handler: "emailCampaign.list",
      config: {},
    },
    {
      method: "GET",
      path: "/emails/options",
      handler: "emailCampaign.options",
      config: {},
    },
    {
      method: "POST",
      path: "/emails/check",
      handler: "emailCampaign.check",
      config: {},
    },
    {
      method: "POST",
      path: "/emails/preview",
      handler: "emailCampaign.preview",
      config: {},
    },
    {
      method: "POST",
      path: "/emails/images",
      handler: "emailCampaign.uploadImage",
      config: {},
    },
    {
      method: "POST",
      path: "/emails",
      handler: "emailCampaign.create",
      config: {},
    },
    {
      method: "GET",
      path: "/emails/:id",
      handler: "emailCampaign.findOne",
      config: {},
    },
    {
      method: "PATCH",
      path: "/emails/:id",
      handler: "emailCampaign.update",
      config: {},
    },
    {
      method: "DELETE",
      path: "/emails/:id",
      handler: "emailCampaign.remove",
      config: {},
    },
    {
      method: "POST",
      path: "/emails/:id/duplicate",
      handler: "emailCampaign.duplicate",
      config: {},
    },
    {
      method: "POST",
      path: "/emails/:id/test",
      handler: "emailCampaign.test",
      config: {},
    },
    {
      method: "POST",
      path: "/emails/:id/send",
      handler: "emailCampaign.send",
      config: {},
    },
  ],
};
