module.exports = ({ env }) => ({
  email: {
    config: {
      provider: "strapi-provider-email-brevo",
      providerOptions: {
        apiKey: env("BREVO_API_KEY"),
      },
      settings: {
        defaultSenderEmail: env("BREVO_DEFAULT_SENDER_EMAIL"),
        defaultSenderName: env("BREVO_DEFAULT_SENDER_NAME"),
        defaultReplyTo: env("BREVO_DEFAULT_REPLY_TO"),
      },
    },
  },
});
