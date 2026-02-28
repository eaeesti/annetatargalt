"use strict";

const controllers = require("./controllers");
const services = require("./services");

module.exports = {
  controllers,
  services,
  // Note: Routes are defined in src/api/donation/routes/custom-donation-routes.js
  // to maintain backward compatibility with /api/* URLs
};
