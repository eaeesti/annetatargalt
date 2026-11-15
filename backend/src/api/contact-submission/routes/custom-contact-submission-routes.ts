export default {
  routes: [
    // Public, like the donation routes: anyone may send the contact form, so
    // this doesn't wait for a permission set by hand in the database, which a
    // new database doesn't have. The controller limits how often.
    {
      method: "POST",
      path: "/contact",
      handler: "contact-submission.contact",
      config: { auth: false, policies: [] },
    },
  ],
};
