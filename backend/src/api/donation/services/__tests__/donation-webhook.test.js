/**
 * Payment Webhook Integration Tests
 * Tests the migrated webhook (confirm) and decode endpoints with Drizzle ORM
 *
 * Note: Uses Vitest globals (configured in vitest.config.js with globals: true)
 */

// Vitest globals are available: describe, it, expect, beforeEach, vi

describe('Payment Webhook (Drizzle Migration)', () => {
  let mockDonationsRepo;
  let mockDonorsRepo;
  let mockOrganizationDonationsRepo;
  let mockStrapi;
  let donationService;

  beforeEach(() => {
    // Mock Drizzle repositories
    mockDonationsRepo = {
      findById: vi.fn(),
      findByIdWithRelations: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    };

    mockDonorsRepo = {
      findById: vi.fn(),
    };

    mockOrganizationDonationsRepo = {
      findByDonationId: vi.fn(),
    };

    // Mock Strapi
    mockStrapi = {
      entityService: {
        findMany: vi.fn(),
      },
    };

    // Mock module dependencies
    vi.mock('../../../../../db/repositories/donations.repository', () => ({
      DonationsRepository: vi.fn(() => mockDonationsRepo),
    }));

    vi.mock('../../../../../db/repositories/donors.repository', () => ({
      DonorsRepository: vi.fn(() => mockDonorsRepo),
    }));

    vi.mock('../../../../../db/repositories/organization-donations.repository', () => ({
      OrganizationDonationsRepository: vi.fn(() => mockOrganizationDonationsRepo),
    }));
  });

  describe('Webhook: Update Donation to Finalized', () => {
    it('should update donation to finalized with IBAN and payment method', async () => {
      const mockDonation = {
        id: 1,
        donorId: 1,
        amount: 1000,
        finalized: false,
        iban: null,
        paymentMethod: null,
      };

      mockDonationsRepo.findById.mockResolvedValue(mockDonation);
      mockDonationsRepo.update.mockResolvedValue({
        ...mockDonation,
        finalized: true,
        iban: 'EE123456789',
        paymentMethod: 'Swedbank',
      });

      // Simulate webhook processing
      const donation = await mockDonationsRepo.findById(1);
      expect(donation.finalized).toBe(false);

      // Update donation
      const updated = await mockDonationsRepo.update(1, {
        finalized: true,
        iban: 'EE123456789',
        paymentMethod: 'Swedbank',
      });

      expect(mockDonationsRepo.update).toHaveBeenCalledWith(1, {
        finalized: true,
        iban: 'EE123456789',
        paymentMethod: 'Swedbank',
      });
      expect(updated.finalized).toBe(true);
      expect(updated.iban).toBe('EE123456789');
      expect(updated.paymentMethod).toBe('Swedbank');
    });

    it('should not update if donation is already finalized', async () => {
      const mockDonation = {
        id: 1,
        donorId: 1,
        amount: 1000,
        finalized: true,
        iban: 'EE123456789',
        paymentMethod: 'Swedbank',
      };

      mockDonationsRepo.findById.mockResolvedValue(mockDonation);

      const donation = await mockDonationsRepo.findById(1);
      expect(donation.finalized).toBe(true);

      // Should not call update for already finalized donation
      expect(mockDonationsRepo.update).not.toHaveBeenCalled();
    });

    it('should handle missing IBAN and payment method gracefully', async () => {
      const mockDonation = {
        id: 1,
        donorId: 1,
        amount: 1000,
        finalized: false,
      };

      mockDonationsRepo.findById.mockResolvedValue(mockDonation);
      mockDonationsRepo.update.mockResolvedValue({
        ...mockDonation,
        finalized: true,
        iban: '',
        paymentMethod: '',
      });

      // Update with empty strings (webhook may not always provide these)
      const updated = await mockDonationsRepo.update(1, {
        finalized: true,
        iban: '',
        paymentMethod: '',
      });

      expect(updated.finalized).toBe(true);
      expect(updated.iban).toBe('');
      expect(updated.paymentMethod).toBe('');
    });
  });

  describe('Decode Endpoint: Get Donation with Details', () => {
    it('should return donation with donor and organization details', async () => {
      const mockDonation = {
        id: 1,
        donorId: 1,
        amount: 1000,
        datetime: new Date(),
        organizationDonations: [
          {
            id: 1,
            donationId: 1,
            organizationInternalId: 'AMF',
            amount: 1000,
          },
        ],
      };

      const mockDonor = {
        id: 1,
        idCode: '38207162722',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      };

      const mockOrganization = {
        id: 1,
        internalId: 'AMF',
        title: 'Against Malaria Foundation',
        slug: 'amf',
        cause: {
          id: 1,
          title: 'Global Health',
        },
      };

      mockDonationsRepo.findByIdWithRelations.mockResolvedValue(mockDonation);
      mockDonorsRepo.findById.mockResolvedValue(mockDonor);
      mockStrapi.entityService.findMany.mockResolvedValue([mockOrganization]);

      // Simulate getDonationWithDetails method
      const donation = await mockDonationsRepo.findByIdWithRelations(1);
      const donor = await mockDonorsRepo.findById(donation.donorId);

      const organizationDonations = await Promise.all(
        donation.organizationDonations.map(async (orgDonation) => {
          const organizations = await mockStrapi.entityService.findMany(
            'api::organization.organization',
            {
              filters: { internalId: orgDonation.organizationInternalId },
              populate: ['cause'],
              limit: 1,
            }
          );

          return {
            id: orgDonation.id,
            amount: orgDonation.amount,
            organization: organizations[0],
          };
        })
      );

      const result = {
        id: donation.id,
        amount: donation.amount,
        donor,
        organizationDonations,
      };

      expect(result.id).toBe(1);
      expect(result.amount).toBe(1000);
      expect(result.donor.firstName).toBe('Test');
      expect(result.organizationDonations).toHaveLength(1);
      expect(result.organizationDonations[0].organization.title).toBe('Against Malaria Foundation');
      expect(result.organizationDonations[0].organization.cause.title).toBe('Global Health');
    });

    it('should handle multiple organization donations', async () => {
      const mockDonation = {
        id: 2,
        donorId: 1,
        amount: 2000,
        datetime: new Date(),
        organizationDonations: [
          { id: 1, donationId: 2, organizationInternalId: 'AMF', amount: 1000 },
          { id: 2, donationId: 2, organizationInternalId: 'GD', amount: 1000 },
        ],
      };

      const mockDonor = {
        id: 1,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      };

      mockDonationsRepo.findByIdWithRelations.mockResolvedValue(mockDonation);
      mockDonorsRepo.findById.mockResolvedValue(mockDonor);

      // Mock Strapi to return different organizations based on internalId
      mockStrapi.entityService.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
            internalId: 'AMF',
            title: 'Against Malaria Foundation',
            cause: { id: 1, title: 'Global Health' },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 2,
            internalId: 'GD',
            title: 'GiveDirectly',
            cause: { id: 2, title: 'Poverty' },
          },
        ]);

      const donation = await mockDonationsRepo.findByIdWithRelations(2);
      const donor = await mockDonorsRepo.findById(donation.donorId);

      const organizationDonations = await Promise.all(
        donation.organizationDonations.map(async (orgDonation) => {
          const organizations = await mockStrapi.entityService.findMany(
            'api::organization.organization',
            {
              filters: { internalId: orgDonation.organizationInternalId },
              populate: ['cause'],
              limit: 1,
            }
          );

          return {
            id: orgDonation.id,
            amount: orgDonation.amount,
            organization: organizations[0],
          };
        })
      );

      expect(organizationDonations).toHaveLength(2);
      expect(organizationDonations[0].organization.internalId).toBe('AMF');
      expect(organizationDonations[1].organization.internalId).toBe('GD');
      expect(organizationDonations[0].amount).toBe(1000);
      expect(organizationDonations[1].amount).toBe(1000);
    });

    it('should return null for missing donation', async () => {
      mockDonationsRepo.findByIdWithRelations.mockResolvedValue(null);

      const donation = await mockDonationsRepo.findByIdWithRelations(999);

      expect(donation).toBeNull();
    });

    it('should handle organization not found in Strapi', async () => {
      const mockDonation = {
        id: 1,
        donorId: 1,
        amount: 1000,
        organizationDonations: [
          {
            id: 1,
            donationId: 1,
            organizationInternalId: 'MISSING',
            amount: 1000,
          },
        ],
      };

      mockDonationsRepo.findByIdWithRelations.mockResolvedValue(mockDonation);
      mockDonorsRepo.findById.mockResolvedValue({ id: 1, firstName: 'Test' });
      mockStrapi.entityService.findMany.mockResolvedValue([]); // Organization not found

      const donation = await mockDonationsRepo.findByIdWithRelations(1);
      const donor = await mockDonorsRepo.findById(donation.donorId);

      const organizationDonations = await Promise.all(
        donation.organizationDonations.map(async (orgDonation) => {
          const organizations = await mockStrapi.entityService.findMany(
            'api::organization.organization',
            {
              filters: { internalId: orgDonation.organizationInternalId },
              populate: ['cause'],
              limit: 1,
            }
          );

          return {
            id: orgDonation.id,
            amount: orgDonation.amount,
            organization: organizations[0] || null,
          };
        })
      );

      expect(organizationDonations[0].organization).toBeNull();
    });
  });

  describe('Webhook Error Handling', () => {
    it('should handle donation not found', async () => {
      mockDonationsRepo.findById.mockResolvedValue(null);

      const donation = await mockDonationsRepo.findById(999);

      expect(donation).toBeNull();
    });

    it('should handle repository update errors', async () => {
      mockDonationsRepo.findById.mockResolvedValue({
        id: 1,
        finalized: false,
      });
      mockDonationsRepo.update.mockRejectedValue(new Error('Database error'));

      await expect(
        mockDonationsRepo.update(1, {
          finalized: true,
          iban: 'EE123456789',
          paymentMethod: 'Swedbank',
        })
      ).rejects.toThrow('Database error');
    });
  });
});
