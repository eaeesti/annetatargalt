import type { Core } from "@strapi/strapi";
import { redactUrl } from "../utils/redact-url";

/**
 * Strapi's own `strapi::logger`, which this replaces in config/middlewares.js,
 * line for line except for redactUrl. Strapi's logs the raw ctx.url, so every
 * payment confirmation wrote its order token, payer's name and IBAN inside, to
 * the request log.
 */
const requestLogger: Core.MiddlewareFactory = (_config, { strapi }) => {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    const delta = Math.ceil(Date.now() - start);
    strapi.log.http(
      `${ctx.method} ${redactUrl(ctx.url)} (${delta} ms) ${ctx.status}`,
    );
  };
};

export default requestLogger;
