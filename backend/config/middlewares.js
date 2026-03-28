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
  { name: "strapi::body", config: { jsonLimit: "1mb", formLimit: "1mb" } },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];
