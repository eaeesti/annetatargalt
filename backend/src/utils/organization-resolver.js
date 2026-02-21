"use strict";

/**
 * OrganizationResolver - Utility for fetching organization data from Strapi
 *
 * Since organizations remain in Strapi CMS while donations move to Drizzle,
 * we need a utility to resolve organizationInternalId → organization details.
 *
 * This utility provides:
 * - Single organization lookup by internalId
 * - Batch lookup for multiple internalIds (for efficiency)
 * - In-memory caching to reduce Strapi queries
 * - Error handling for missing organizations
 */

class OrganizationResolver {
  constructor(strapi) {
    this.cache = {};
    this.strapi = strapi;
  }

  /**
   * Fetch a single organization by internalId from Strapi
   */
  async findByInternalId(internalId) {
    // Check cache first
    if (this.cache[internalId]) {
      return this.cache[internalId];
    }

    // Fetch from Strapi
    const organizations = await this.strapi.entityService.findMany(
      "api::organization.organization",
      {
        filters: { internalId },
        limit: 1,
      }
    );

    if (organizations.length === 0) {
      return null;
    }

    const organization = organizations[0];
    this.cache[internalId] = organization;
    return organization;
  }

  /**
   * Fetch multiple organizations by internalIds (batch operation)
   * Returns a Map of internalId → organization
   */
  async findManyByInternalIds(internalIds) {
    const result = new Map();
    const uncachedIds = [];

    // Check cache first
    for (const internalId of internalIds) {
      if (this.cache[internalId]) {
        result.set(internalId, this.cache[internalId]);
      } else {
        uncachedIds.push(internalId);
      }
    }

    // Fetch uncached organizations from Strapi
    if (uncachedIds.length > 0) {
      const organizations = await this.strapi.entityService.findMany(
        "api::organization.organization",
        {
          filters: { internalId: { $in: uncachedIds } },
        }
      );

      // Add to cache and result
      for (const organization of organizations) {
        this.cache[organization.internalId] = organization;
        result.set(organization.internalId, organization);
      }
    }

    return result;
  }

  /**
   * Verify that an organization exists and is active
   * Useful for validation
   */
  async isValidOrganization(internalId) {
    const organization = await this.findByInternalId(internalId);
    return organization !== null && organization.active === true;
  }

  /**
   * Clear the cache (useful for testing or when organizations are updated)
   */
  clearCache() {
    this.cache = {};
  }
}

/**
 * Factory function to create OrganizationResolver instances
 * Usage in Strapi services:
 *   const resolver = createOrganizationResolver(strapi);
 *   const org = await resolver.findByInternalId('AMF');
 */
function createOrganizationResolver(strapi) {
  return new OrganizationResolver(strapi);
}

module.exports = { createOrganizationResolver, OrganizationResolver };
