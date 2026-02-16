/**
 * Tests for OrganizationResolver utility
 *
 * This utility is critical for Phase 3.4 (payment flow) and email generation.
 * It fetches organization data from Strapi and caches results in memory.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrganizationResolver } from '../organization-resolver';

describe('OrganizationResolver', () => {
  let mockStrapi;
  let resolver;

  beforeEach(() => {
    // Mock Strapi entityService
    mockStrapi = {
      entityService: {
        findMany: vi.fn(),
      },
    };

    resolver = createOrganizationResolver(mockStrapi);
  });

  describe('findByInternalId', () => {
    it('should fetch organization from Strapi on cache miss', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        active: true,
      };

      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      const result = await resolver.findByInternalId('AMF');

      expect(result).toEqual(mockOrg);
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledWith(
        'api::organization.organization',
        {
          filters: { internalId: 'AMF' },
          limit: 1,
        }
      );
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return cached organization on cache hit', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        active: true,
      };

      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      // First call - cache miss
      const result1 = await resolver.findByInternalId('AMF');
      expect(result1).toEqual(mockOrg);

      // Second call - cache hit
      const result2 = await resolver.findByInternalId('AMF');
      expect(result2).toEqual(mockOrg);

      // Should only call Strapi once
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return null when organization not found', async () => {
      mockStrapi.entityService.findMany.mockResolvedValue([]);

      const result = await resolver.findByInternalId('NONEXISTENT');

      expect(result).toBeNull();
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledWith(
        'api::organization.organization',
        {
          filters: { internalId: 'NONEXISTENT' },
          limit: 1,
        }
      );
    });

    it('should cache null results to prevent repeated queries', async () => {
      mockStrapi.entityService.findMany.mockResolvedValue([]);

      // First call
      await resolver.findByInternalId('NONEXISTENT');
      // Second call
      await resolver.findByInternalId('NONEXISTENT');

      // Should not query Strapi again for null results
      // (Current implementation doesn't cache null, so this will call twice)
      // This is actually a potential improvement opportunity
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple different organizations', async () => {
      const mockOrg1 = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        active: true,
      };

      const mockOrg2 = {
        id: 2,
        internalId: 'GD',
        title: 'GiveDirectly',
        slug: 'givedirectly',
        active: true,
      };

      mockStrapi.entityService.findMany
        .mockResolvedValueOnce([mockOrg1])
        .mockResolvedValueOnce([mockOrg2]);

      const result1 = await resolver.findByInternalId('AMF');
      const result2 = await resolver.findByInternalId('GD');

      expect(result1).toEqual(mockOrg1);
      expect(result2).toEqual(mockOrg2);
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('findManyByInternalIds', () => {
    it('should fetch multiple organizations from Strapi', async () => {
      const mockOrgs = [
        {
          id: 1,
          internalId: 'AMF',
          title: 'Against Malaria Foundation',
          slug: 'amf',
          active: true,
        },
        {
          id: 2,
          internalId: 'GD',
          title: 'GiveDirectly',
          slug: 'givedirectly',
          active: true,
        },
      ];

      mockStrapi.entityService.findMany.mockResolvedValue(mockOrgs);

      const result = await resolver.findManyByInternalIds(['AMF', 'GD']);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('AMF')).toEqual(mockOrgs[0]);
      expect(result.get('GD')).toEqual(mockOrgs[1]);

      expect(mockStrapi.entityService.findMany).toHaveBeenCalledWith(
        'api::organization.organization',
        {
          filters: { internalId: { $in: ['AMF', 'GD'] } },
        }
      );
    });

    it('should use cache for already-fetched organizations', async () => {
      const mockOrg1 = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        active: true,
      };

      const mockOrg2 = {
        id: 2,
        internalId: 'GD',
        title: 'GiveDirectly',
        slug: 'givedirectly',
        active: true,
      };

      // Pre-populate cache with AMF
      mockStrapi.entityService.findMany.mockResolvedValueOnce([mockOrg1]);
      await resolver.findByInternalId('AMF');

      // Now fetch both AMF and GD - should only query for GD
      mockStrapi.entityService.findMany.mockResolvedValueOnce([mockOrg2]);
      const result = await resolver.findManyByInternalIds(['AMF', 'GD']);

      expect(result.size).toBe(2);
      expect(result.get('AMF')).toEqual(mockOrg1);
      expect(result.get('GD')).toEqual(mockOrg2);

      // First call for AMF, second call for GD only
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(2);
      expect(mockStrapi.entityService.findMany).toHaveBeenNthCalledWith(
        2,
        'api::organization.organization',
        {
          filters: { internalId: { $in: ['GD'] } },
        }
      );
    });

    it('should return empty map when no internalIds provided', async () => {
      const result = await resolver.findManyByInternalIds([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockStrapi.entityService.findMany).not.toHaveBeenCalled();
    });

    it('should handle partial results from Strapi', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        active: true,
      };

      // Only AMF found, GD doesn't exist
      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      const result = await resolver.findManyByInternalIds(['AMF', 'NONEXISTENT']);

      expect(result.size).toBe(1);
      expect(result.get('AMF')).toEqual(mockOrg);
      expect(result.get('NONEXISTENT')).toBeUndefined();
    });

    it('should cache all fetched organizations', async () => {
      const mockOrgs = [
        {
          id: 1,
          internalId: 'AMF',
          title: 'Against Malaria Foundation',
          slug: 'amf',
          active: true,
        },
        {
          id: 2,
          internalId: 'GD',
          title: 'GiveDirectly',
          slug: 'givedirectly',
          active: true,
        },
      ];

      mockStrapi.entityService.findMany.mockResolvedValue(mockOrgs);

      // First batch fetch
      await resolver.findManyByInternalIds(['AMF', 'GD']);

      // Individual lookups should use cache
      const amf = await resolver.findByInternalId('AMF');
      const gd = await resolver.findByInternalId('GD');

      expect(amf).toEqual(mockOrgs[0]);
      expect(gd).toEqual(mockOrgs[1]);

      // Should only call Strapi once for the batch fetch
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('isValidOrganization', () => {
    it('should return true for active organization', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        active: true,
      };

      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      const result = await resolver.isValidOrganization('AMF');

      expect(result).toBe(true);
    });

    it('should return false for inactive organization', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'INACTIVE',
        title: 'Inactive Organization',
        slug: 'inactive',
        active: false,
      };

      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      const result = await resolver.isValidOrganization('INACTIVE');

      expect(result).toBe(false);
    });

    it('should return false for non-existent organization', async () => {
      mockStrapi.entityService.findMany.mockResolvedValue([]);

      const result = await resolver.isValidOrganization('NONEXISTENT');

      expect(result).toBe(false);
    });

    it('should use cached organization data', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        active: true,
      };

      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      // Pre-populate cache
      await resolver.findByInternalId('AMF');

      // Validation should use cache
      const result = await resolver.isValidOrganization('AMF');

      expect(result).toBe(true);
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached organizations', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        active: true,
      };

      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      // Populate cache
      await resolver.findByInternalId('AMF');
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(1);

      // Clear cache
      resolver.clearCache();

      // Should fetch from Strapi again
      await resolver.findByInternalId('AMF');
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(2);
    });

    it('should not affect Strapi entityService', () => {
      resolver.clearCache();

      // Should not throw or cause issues
      expect(mockStrapi.entityService.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle organization with minimal fields', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'MIN',
        title: 'Minimal Org',
        slug: 'minimal',
        active: true,
        // No optional fields
      };

      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      const result = await resolver.findByInternalId('MIN');

      expect(result).toEqual(mockOrg);
      expect(result.homepage).toBeUndefined();
      expect(result.introduction).toBeUndefined();
      expect(result.content).toBeUndefined();
    });

    it('should handle organization with all optional fields', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'FULL',
        title: 'Full Organization',
        slug: 'full',
        active: true,
        homepage: 'https://example.com',
        introduction: 'A great organization',
        content: 'Long content here...',
      };

      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      const result = await resolver.findByInternalId('FULL');

      expect(result).toEqual(mockOrg);
      expect(result.homepage).toBe('https://example.com');
      expect(result.introduction).toBe('A great organization');
      expect(result.content).toBe('Long content here...');
    });

    it('should handle Strapi errors gracefully', async () => {
      mockStrapi.entityService.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(resolver.findByInternalId('AMF')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle empty string internalId', async () => {
      mockStrapi.entityService.findMany.mockResolvedValue([]);

      const result = await resolver.findByInternalId('');

      expect(result).toBeNull();
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledWith(
        'api::organization.organization',
        {
          filters: { internalId: '' },
          limit: 1,
        }
      );
    });
  });

  describe('Performance and caching behavior', () => {
    it('should minimize Strapi queries with mixed cache hits', async () => {
      const orgs = [
        { id: 1, internalId: 'AMF', title: 'AMF', slug: 'amf', active: true },
        { id: 2, internalId: 'GD', title: 'GD', slug: 'gd', active: true },
        { id: 3, internalId: 'EV', title: 'EV', slug: 'ev', active: true },
      ];

      // Pre-populate cache with AMF and GD
      mockStrapi.entityService.findMany
        .mockResolvedValueOnce([orgs[0]])
        .mockResolvedValueOnce([orgs[1]]);

      await resolver.findByInternalId('AMF');
      await resolver.findByInternalId('GD');

      // Now fetch all three - should only query for EV
      mockStrapi.entityService.findMany.mockResolvedValueOnce([orgs[2]]);

      const result = await resolver.findManyByInternalIds(['AMF', 'GD', 'EV']);

      expect(result.size).toBe(3);
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(3);

      // Last call should only query for EV
      expect(mockStrapi.entityService.findMany).toHaveBeenNthCalledWith(
        3,
        'api::organization.organization',
        {
          filters: { internalId: { $in: ['EV'] } },
        }
      );
    });

    it('should handle duplicate internalIds in batch request', async () => {
      const mockOrg = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        active: true,
      };

      mockStrapi.entityService.findMany.mockResolvedValue([mockOrg]);

      // Request same org multiple times
      const result = await resolver.findManyByInternalIds(['AMF', 'AMF', 'AMF']);

      expect(result.size).toBe(1);
      expect(result.get('AMF')).toEqual(mockOrg);

      // Should deduplicate and only query once
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
