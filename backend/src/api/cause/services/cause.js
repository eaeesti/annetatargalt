"use strict";

/**
 * cause service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::cause.cause", ({ strapi }) => ({
  async findCause(causeTitle) {
    const causeEntries = await strapi.entityService.findMany(
      "api::cause.cause",
      { filters: { title: causeTitle } }
    );

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

    const newCauseEntry = await strapi.entityService.create(
      "api::cause.cause",
      {
        data: cause,
      }
    );

    return newCauseEntry;
  },
}));
