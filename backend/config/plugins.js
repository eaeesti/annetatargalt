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
      provider: "nodemailer",
      providerOptions: {
        host: env("SMTP_HOST", "smtp-relay.brevo.com"),
        port: env.int("SMTP_PORT", 587),
        secure: false,
        // Port 587 starts in plain text and upgrades with STARTTLS; without
        // this, a server (or anyone between) that doesn't offer the upgrade
        // would get the password and every email unencrypted.
        requireTLS: true,
        auth: {
          user: env("SMTP_USERNAME"),
          pass: env("SMTP_PASSWORD"),
        },
        // Well under the two minutes after which another backend process
        // takes over sending an email from the admin panel
        // (HEARTBEAT_STALE_MS): a copy still on its way by then could be
        // neither put back nor failed. Nodemailer's own wait up to 2 minutes
        // to connect and 10 for a silent server.
        dnsTimeout: 10 * 1000,
        connectionTimeout: 15 * 1000,
        greetingTimeout: 15 * 1000,
        socketTimeout: 30 * 1000,
      },
      settings: {
        defaultFrom: env("BREVO_DEFAULT_SENDER_EMAIL"),
        defaultReplyTo: env("BREVO_DEFAULT_REPLY_TO"),
      },
    },
  },
  donations: {
    enabled: true,
    resolve: "./dist/src/plugins/donations",
  },
  "admin-panel": {
    enabled: true,
    resolve: "./dist/src/plugins/admin-panel",
  },
  "users-permissions": {
    config: {
      jwt: { expiresIn: "8h" },
    },
  },
  "deep-populate": {
    enabled: true,
    config: {
      useCache: false,
      replaceWildcard: true, // default
    },
  },
});
