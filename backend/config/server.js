module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  // Koa only reads the client's real address out of X-Forwarded-For when
  // app.proxy is on, and Strapi wires app.proxy from `server.proxy.koa`
  // specifically — a bare `proxy: true` is read as `server.proxy.koa ===
  // undefined` and silently does nothing. Without this every request looks
  // like it came from the reverse proxy, so ctx.request.ip is a constant and
  // anything keyed on it (login lockout, the global limiter, audit rows)
  // collapses into one shared bucket.
  //
  // Defaults to off, and must stay off unless the proxy in front of this app
  // *overwrites* X-Forwarded-For with the real peer address rather than
  // appending to it. Koa trusts the leftmost entry, so with an appending
  // proxy — or no proxy at all — a client can put any address it likes in
  // the header and pick its own rate-limit bucket, which is worse than not
  // trusting the header in the first place.
  proxy: { koa: env.bool("SERVER_PROXY", false) },
  app: {
    keys: env.array("APP_KEYS"),
  },
  webhooks: {
    populateRelations: env.bool("WEBHOOKS_POPULATE_RELATIONS", false),
  },
});
