'use strict';

/**
 * special-page service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::special-page.special-page');
