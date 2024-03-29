module.exports = {
  routes: [
    {
      method: "POST",
      path: "/sendEmail",
      handler: "email-config.sendEmail",
    },
  ],
};
