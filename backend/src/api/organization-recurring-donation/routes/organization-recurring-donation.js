"use strict";

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter(
  "api::organization-recurring-donation.organization-recurring-donation"
);
