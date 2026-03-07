import type { Core } from "@strapi/strapi";

declare global {
  const strapi: Core.Strapi;
}
