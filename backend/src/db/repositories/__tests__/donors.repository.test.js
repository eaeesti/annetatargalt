/**
 * Integration tests for DonorsRepository
 *
 * Tests donor CRUD operations and lookups (critical for payment flow).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { donorsRepository } from '../donors.repository';
import { cleanDatabase, createTestDonor } from '../../__tests__/test-db-helper';

describe('DonorsRepository', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('create', () => {
    it('should create a donor with all required fields', async () => {
      const donor = await donorsRepository.create({
        idCode: '38207162722',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      });

      expect(donor).toBeDefined();
      expect(donor.id).toBeDefined();
      expect(donor.idCode).toBe('38207162722');
      expect(donor.firstName).toBe('Jane');
      expect(donor.lastName).toBe('Doe');
      expect(donor.email).toBe('jane@example.com');
    });
  });

  describe('findById', () => {
    it('should find a donor by ID', async () => {
      const created = await createTestDonor({ firstName: 'Alice' });

      const found = await donorsRepository.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.firstName).toBe('Alice');
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await donorsRepository.findById(99999);

      expect(found).toBeUndefined();
    });
  });

  describe('findByIdCode', () => {
    it('should find a donor by Estonian ID code', async () => {
      await createTestDonor({ idCode: '38207162722', firstName: 'Test' });

      const found = await donorsRepository.findByIdCode('38207162722');

      expect(found).toBeDefined();
      expect(found.idCode).toBe('38207162722');
      expect(found.firstName).toBe('Test');
    });

    it('should find a donor by company code (non-11-char)', async () => {
      await createTestDonor({ idCode: '12345678', firstName: 'Company' });

      const found = await donorsRepository.findByIdCode('12345678');

      expect(found).toBeDefined();
      expect(found.idCode).toBe('12345678');
    });

    it('should return undefined for non-existent ID code', async () => {
      const found = await donorsRepository.findByIdCode('99999999999');

      expect(found).toBeUndefined();
    });
  });

  describe('findByEmail', () => {
    it('should find a donor by email', async () => {
      await createTestDonor({ email: 'unique@example.com', firstName: 'Unique' });

      const found = await donorsRepository.findByEmail('unique@example.com');

      expect(found).toBeDefined();
      expect(found.email).toBe('unique@example.com');
      expect(found.firstName).toBe('Unique');
    });

    it('should return undefined for non-existent email', async () => {
      const found = await donorsRepository.findByEmail('nonexistent@example.com');

      expect(found).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update donor fields', async () => {
      const donor = await createTestDonor({ firstName: 'Old', email: 'old@example.com' });

      const updated = await donorsRepository.update(donor.id, {
        firstName: 'New',
        email: 'new@example.com',
      });

      expect(updated).toBeDefined();
      expect(updated.firstName).toBe('New');
      expect(updated.email).toBe('new@example.com');
      expect(updated.lastName).toBe(donor.lastName); // Unchanged
    });
  });


  describe('ID code validation scenarios', () => {
    it('should handle valid Estonian personal ID codes', async () => {
      const validIdCodes = [
        '38207162722',
        '50208130249',
        '39912319873',
      ];

      for (const idCode of validIdCodes) {
        const donor = await donorsRepository.create({
          idCode,
          firstName: 'Test',
          lastName: 'User',
          email: `${idCode}@example.com`,
        });

        expect(donor.idCode).toBe(idCode);
      }
    });

    it('should handle company codes (non-personal)', async () => {
      const companyCodes = [
        '12345678',     // 8-digit company code
        '1234567890',   // 10-digit code
      ];

      for (const idCode of companyCodes) {
        const donor = await donorsRepository.create({
          idCode,
          firstName: 'Company',
          lastName: 'Name',
          email: `${idCode}@company.com`,
        });

        expect(donor.idCode).toBe(idCode);
      }
    });
  });

  describe('Email format scenarios', () => {
    it('should accept various valid email formats', async () => {
      const validEmails = [
        'simple@example.com',
        'first.last@example.com',
        'user+tag@example.co.uk',
        'name123@test-domain.com',
      ];

      for (let i = 0; i < validEmails.length; i++) {
        const donor = await donorsRepository.create({
          idCode: `1234567${i}`,
          firstName: 'Test',
          lastName: 'User',
          email: validEmails[i],
        });

        expect(donor.email).toBe(validEmails[i]);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle donors with very long names', async () => {
      const donor = await donorsRepository.create({
        idCode: '38207162722',
        firstName: 'A'.repeat(128),
        lastName: 'B'.repeat(128),
        email: 'test@example.com',
      });

      expect(donor.firstName.length).toBe(128);
      expect(donor.lastName.length).toBe(128);
    });

    it('should handle special characters in names', async () => {
      const donor = await donorsRepository.create({
        idCode: '38207162722',
        firstName: 'Jüri',
        lastName: 'Õunapuu-Käär',
        email: 'test@example.com',
      });

      expect(donor.firstName).toBe('Jüri');
      expect(donor.lastName).toBe('Õunapuu-Käär');
    });
  });
});
