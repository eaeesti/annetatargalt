declare module "koa2-ratelimit" {
  import type { Context, Middleware } from "koa";
  export const RateLimit: {
    middleware(options: {
      interval?: { min?: number; hour?: number; day?: number } | number;
      max?: number;
      message?: string;
      /** Whose requests a request counts towards; its address by default. */
      keyGenerator?: (ctx: Context) => Promise<string> | string;
    }): Middleware;
  };
}
