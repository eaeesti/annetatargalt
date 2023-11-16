"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::organization-recurring-donation.organization-recurring-donation"
);
