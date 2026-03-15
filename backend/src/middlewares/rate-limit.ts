import { RateLimit } from "koa2-ratelimit";

export default () => {
  return RateLimit.middleware({
    interval: { min: 15 },
    max: 1000,
    message: "Too many requests, please try again later.",
  });
};
