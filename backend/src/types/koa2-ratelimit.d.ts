declare module "koa2-ratelimit" {
  import type { Middleware } from "koa";
  export const RateLimit: {
    middleware(options: {
      interval?: { min?: number; hour?: number; day?: number } | number;
      max?: number;
      message?: string;
    }): Middleware;
  };
}
