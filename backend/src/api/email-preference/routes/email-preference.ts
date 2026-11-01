export default {
  routes: [
    // Public: the token in the link from an email is all the page has. It
    // comes in the body, not the query string, which logs keep.
    {
      method: "POST",
      path: "/email-preferences/find",
      handler: "email-preference.find",
      config: { auth: false, policies: [] },
    },
    {
      method: "PUT",
      path: "/email-preferences",
      handler: "email-preference.update",
      config: { auth: false, policies: [] },
    },
    // A mail client's own unsubscribe button, by way of the site.
    {
      method: "POST",
      path: "/email-preferences/unsubscribe",
      handler: "email-preference.unsubscribe",
      config: { auth: false, policies: [] },
    },
  ],
};
