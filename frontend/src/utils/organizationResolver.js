/**
 * Resolves organization references to internalId
 * Supports both numeric IDs (legacy URLs) and internalIds
 */
export class OrganizationResolver {
  constructor(causes) {
    // Build lookup maps
    this.byNumericId = new Map();
    this.byInternalId = new Map();

    causes.data?.forEach((cause) => {
      cause.attributes.organizations.data.forEach((org) => {
        const orgData = {
          id: org.id,
          internalId: org.attributes.internalId,
          title: org.attributes.title,
          slug: org.attributes.slug,
          fund: org.attributes.fund,
        };

        this.byNumericId.set(org.id, orgData);
        this.byInternalId.set(org.attributes.internalId, orgData);
      });
    });
  }

  /**
   * Resolve any organization reference to internalId
   * @param {number|string} ref - Numeric ID or internalId
   * @returns {string|null} internalId or null if not found
   */
  resolveToInternalId(ref) {
    if (!ref) return null;

    // If it's a number or numeric string, lookup by numeric ID
    const numericId = parseInt(ref);
    if (!isNaN(numericId)) {
      const org = this.byNumericId.get(numericId);
      return org?.internalId || null;
    }

    // Otherwise assume it's already an internalId
    const org = this.byInternalId.get(ref);
    return org?.internalId || null;
  }

  /**
   * Get organization data by any reference
   */
  getOrganization(ref) {
    if (!ref) return null;

    const numericId = parseInt(ref);
    if (!isNaN(numericId)) {
      return this.byNumericId.get(numericId) || null;
    }

    return this.byInternalId.get(ref) || null;
  }

  /**
   * Check if a reference exists
   */
  exists(ref) {
    return this.resolveToInternalId(ref) !== null;
  }
}
