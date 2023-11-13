'use strict';

/**
 * recurring-donation service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::recurring-donation.recurring-donation');
