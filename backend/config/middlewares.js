module.exports = [
  "strapi::logger",
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          "img-src": ["'self'", "data:", "blob:", "res.cloudinary.com"],
          "media-src": ["'self'", "data:", "blob:", "res.cloudinary.com"],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  "global::rate-limit",
  "strapi::cors",
  "strapi::poweredBy",
  "strapi::query",
  // statement-import `apply` posts the parsed statement back as JSON (every
  // credit + debit line); a multi-year LHV export is well under 5mb.
  { name: "strapi::body", config: { jsonLimit: "5mb", formLimit: "5mb" } },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];
