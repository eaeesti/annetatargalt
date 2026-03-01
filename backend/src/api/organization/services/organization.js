"use strict";

/**
 * organization service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService(
  "api::organization.organization",
  ({ strapi }) => ({
    async findOrganization(organizationTitle) {
      const organizationEntries = await strapi.documents(
        "api::organization.organization"
      ).findMany({
        filters: { title: organizationTitle },
      });

      if (organizationEntries.length > 0) {
        return organizationEntries[0];
      }

      return null;
    },

    async findOrCreateOrganization(organization) {
      const organizationEntry = await this.findOrganization(organization.title);

      if (organizationEntry) {
        return organizationEntry;
      }

      const newOrganizationEntry = await strapi.documents(
        "api::organization.organization"
      ).create({
        data: organization,
      });

      return newOrganizationEntry;
    },
  })
);
