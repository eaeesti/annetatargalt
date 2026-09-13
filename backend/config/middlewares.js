module.exports = ({ env }) => [
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
  {
    name: "strapi::cors",
    config: {
      // Strapi's default is `origin: '*'` + `credentials: true` — which it
      // implements by reflecting whatever Origin header the request sent,
      // since a literal `*` can't be combined with credentials. That means
      // it echoes back any origin at all, credentialed. Nothing that calls
      // the content API from a browser (the public frontend's client
      // components) sends cookies, so there's no need for credentials, and
      // the origin list should be the frontend's real origin(s) plus
      // anything added via CORS_ORIGINS (comma-separated — e.g. Vercel
      // preview URLs), not every origin on the internet.
      //
      // Not using env.array() here: it falls back to the default only when
      // the key is entirely absent (lodash `_.has`), not when it's merely
      // empty — a bare `CORS_ORIGINS=` would resolve to `[""]`, which
      // matches no real Origin header and locks out the actual production
      // frontend too. Parse it by hand so blank-or-unset both mean "use the
      // default".
      origin: (() => {
        const raw = env("CORS_ORIGINS", "").trim();
        const configured = raw
          ? raw
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : [];
        // localhost:3000 is the frontend's own local dev origin — harmless
        // to always allow since no real visitor's browser is ever actually
        // at that origin, and it means dev doesn't silently break every
        // time this list changes.
        return [
          "https://annetatargalt.ee",
          "https://www.annetatargalt.ee", // redirects to the apex today, but costs nothing to allow in case that ever changes
          "http://localhost:3000",
          ...configured,
        ];
      })(),
      credentials: false,
    },
  },
  "global::rate-limit",
  "strapi::query",
  // statement-import `apply` posts the parsed statement back as JSON (every
  // credit + debit line); a multi-year LHV export is well under 5mb.
  { name: "strapi::body", config: { jsonLimit: "5mb", formLimit: "5mb" } },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];
