import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { RateLimit } from "koa2-ratelimit";
import { tokenUserId } from "../strapi-internals";
import { isInternalAddress } from "../utils/rate-limiter";

const WINDOW = { min: 15 };
const MESSAGE = "Too many requests, please try again later.";

/** Requests from one address in a window. */
const ADDRESS_MAX = 1000;

/**
 * Requests from one signed-in person in a window. Theirs all come from the
 * admin panel's server, so by address everyone signed in would share one
 * limit, and writing an email (a save, a check and a preview after each
 * pause in typing) could use it up for all of them. This is more than
 * typing all through the window takes, and still stops a stolen token from
 * flooding.
 */
const PERSON_MAX = 5000;

/**
 * Every request counts towards a limit: a signed-in person's towards their
 * own, anyone else's towards their address's. It's before any route, so who
 * signed in is read from the token here.
 *
 * Except requests from internal addresses (isInternalAddress): the site's
 * server fetches every page's content from one, and counting them would put
 * the whole site's traffic in one bucket, which a crawler after a cache flush
 * could empty, and Strapi would then refuse the site's own page renders.
 */
const rateLimit: Core.MiddlewareFactory = (_config, { strapi }) => {
  const people = new WeakMap<Context, number>();
  const byAddress = RateLimit.middleware({
    interval: WINDOW,
    max: ADDRESS_MAX,
    message: MESSAGE,
  });
  const byPerson = RateLimit.middleware({
    interval: WINDOW,
    max: PERSON_MAX,
    message: MESSAGE,
    keyGenerator: (ctx) => `person|${people.get(ctx)}`,
  });
  return async (ctx, next) => {
    const person = await tokenUserId(strapi, ctx);
    if (person === null) {
      return isInternalAddress(ctx.request.ip) ? next() : byAddress(ctx, next);
    }
    people.set(ctx, person);
    return byPerson(ctx, next);
  };
};

export default rateLimit;
