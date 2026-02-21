"use strict";

/**
 * email-config service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::email-config.email-config");
