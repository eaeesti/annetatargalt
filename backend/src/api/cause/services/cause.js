"use strict";

/**
 * cause service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::cause.cause", ({ strapi }) => ({
  async findCause(causeTitle) {
    const causeEntries = await strapi.documents("api::cause.cause").findMany({
      filters: { title: causeTitle },
    });

    if (causeEntries.length > 0) {
      return causeEntries[0];
    }

    return null;
  },

  async findOrCreateCause(cause) {
    const causeEntry = await this.findCause(cause.title);

    if (causeEntry) {
      return causeEntry;
    }

    const newCauseEntry = await strapi.documents("api::cause.cause").create({
      data: cause,
    });

    return newCauseEntry;
  },
}));
