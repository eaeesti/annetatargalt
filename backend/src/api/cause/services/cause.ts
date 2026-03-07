/**
 * cause service
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreService(
  "api::cause.cause",
  ({ strapi }) => ({
    async findCause(causeTitle: string) {
      const causeEntries = await strapi
        .documents("api::cause.cause")
        .findMany({
          filters: { title: causeTitle },
        });

      if (causeEntries.length > 0) {
        return causeEntries[0];
      }

      return null;
    },

    async findOrCreateCause(cause: { title: string; [key: string]: unknown }) {
      const causeEntry = await this.findCause(cause.title);

      if (causeEntry) {
        return causeEntry;
      }

      const newCauseEntry = await strapi.documents("api::cause.cause").create({
        data: cause,
      });

      return newCauseEntry;
    },
  })
);
