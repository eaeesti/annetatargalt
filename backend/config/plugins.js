module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "cloudinary",
      providerOptions: {
        cloud_name: env("CLOUDINARY_NAME"),
        api_key: env("CLOUDINARY_KEY"),
        api_secret: env("CLOUDINARY_SECRET"),
      },
      actionOptions: {
        upload: {},
        delete: {},
      },
    },
  },
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
  donations: {
    enabled: true,
    resolve: "./src/plugins/donations",
  },
});
