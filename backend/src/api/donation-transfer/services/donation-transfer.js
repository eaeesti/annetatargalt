'use strict';

/**
 * donation-transfer service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::donation-transfer.donation-transfer');
