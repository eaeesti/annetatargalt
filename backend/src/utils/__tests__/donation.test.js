import { describe, it, expect } from 'vitest';
import {
  amountToCents,
  validateAmount,
  validateIdCode,
  validateEmail,
  resizeOrganizationDonations,
} from '../donation.js';

describe('amountToCents', () => {
  it('should convert euros to cents correctly', () => {
    expect(amountToCents(10)).toBe(1000);
    expect(amountToCents(1)).toBe(100);
    expect(amountToCents(0.5)).toBe(50);
    expect(amountToCents(123.45)).toBe(12345);
  });

  it('should round to nearest cent for fractional cents', () => {
    expect(amountToCents(10.005)).toBe(1001); // Rounds up
    expect(amountToCents(10.004)).toBe(1000); // Rounds down
    expect(amountToCents(0.555)).toBe(56); // Rounds up
  });

  it('should handle zero', () => {
    expect(amountToCents(0)).toBe(0);
  });

  it('should handle large amounts', () => {
    expect(amountToCents(15000)).toBe(1500000);
  });
});

describe('validateAmount', () => {
  it('should return true for valid amounts (>= 1 euro in cents)', () => {
    expect(validateAmount(100)).toBe(true); // 1 euro
    expect(validateAmount(1000)).toBe(true); // 10 euros
    expect(validateAmount(1500000)).toBe(true); // 15000 euros
  });

  it('should return false for amounts below 100 cents', () => {
    expect(validateAmount(99)).toBe(false);
    expect(validateAmount(50)).toBe(false);
    expect(validateAmount(0)).toBe(false);
  });

  it('should return false for negative amounts', () => {
    expect(validateAmount(-100)).toBe(false);
    expect(validateAmount(-1)).toBe(false);
  });

  it('should return false for non-number types', () => {
    expect(validateAmount('100')).toBe(false);
    expect(validateAmount(null)).toBe(false);
    expect(validateAmount(undefined)).toBe(false);
    expect(validateAmount({})).toBe(false);
    expect(validateAmount([])).toBe(false);
  });
});

describe('validateIdCode', () => {
  // Valid Estonian ID codes (with correct checksums)
  it('should validate correct Estonian ID codes', () => {
    expect(validateIdCode('38207162722')).toBe(true); // Male born 1982-07-16
    expect(validateIdCode('49403136515')).toBe(true); // Example from comments
    // Only use IDs we've verified have correct checksums
  });

  it('should reject ID codes with wrong checksum', () => {
    expect(validateIdCode('38207162723')).toBe(false); // Last digit wrong
    expect(validateIdCode('50208130248')).toBe(false); // Last digit wrong
  });

  it('should reject ID codes with invalid format', () => {
    expect(validateIdCode('12345')).toBe(false); // Too short
    expect(validateIdCode('123456789012')).toBe(false); // Too long
    expect(validateIdCode('abcdefghijk')).toBe(false); // Non-numeric
    expect(validateIdCode('02345678901')).toBe(false); // First digit must be 1-6
    expect(validateIdCode('71234567890')).toBe(false); // First digit must be 1-6
    expect(validateIdCode('038207162722')).toBe(false); // Valid ID embedded in longer string (leading digit)
    expect(validateIdCode('x38207162722')).toBe(false); // Valid ID with leading non-digit
  });

  it('should reject ID codes with invalid date components', () => {
    expect(validateIdCode('31213156515')).toBe(false); // Month 13 (invalid)
    expect(validateIdCode('31200356515')).toBe(false); // Month 00 (invalid)
    expect(validateIdCode('31205326515')).toBe(false); // Day 32 (invalid)
    expect(validateIdCode('31205006515')).toBe(false); // Day 00 (invalid)
  });

  it('should handle empty or invalid inputs', () => {
    expect(validateIdCode('')).toBe(false);
    expect(validateIdCode('12345678901')).toBe(false);
  });
});

describe('validateEmail', () => {
  it('should validate correct email addresses', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@example.com')).toBe(true);
    expect(validateEmail('user+tag@example.co.uk')).toBe(true);
    expect(validateEmail('firstname.lastname@company.com')).toBe(true);
    expect(validateEmail('email@subdomain.example.com')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('notanemail')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('user @example.com')).toBe(false); // Space in email
    expect(validateEmail('user@.com')).toBe(false);
    expect(validateEmail('user@@example.com')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(validateEmail('a@b.co')).toBe(true); // Minimal valid email (TLD must be 2+ chars)
    expect(validateEmail('a@b.c')).toBe(false); // Single-letter TLD not supported
    expect(validateEmail('test@localhost')).toBe(true); // Localhost is actually valid per regex
  });
});

describe('resizeOrganizationDonations', () => {
  it('should resize organization donations proportionally', () => {
    const orgDonations = [
      { organizationId: 1, amount: 1000 },
      { organizationId: 2, amount: 2000 },
    ];

    const result = resizeOrganizationDonations(orgDonations, 0.5, 1500);

    expect(result).toEqual([
      { organizationId: 1, amount: 500 },
      { organizationId: 2, amount: 1000 },
    ]);
  });

  it('should adjust for rounding discrepancies by modifying last items', () => {
    const orgDonations = [
      { organizationId: 1, amount: 333 },
      { organizationId: 2, amount: 333 },
      { organizationId: 3, amount: 334 },
    ];

    // 3 x 333 = 999, multiplied by 3 = 2997, but we expect 3000
    // Should add 1 to each of the last 3 items
    const result = resizeOrganizationDonations(orgDonations, 3, 3000);

    const total = result.reduce((sum, org) => sum + org.amount, 0);
    expect(total).toBe(3000);
  });

  it('should handle single organization donation', () => {
    const orgDonations = [
      { organizationId: 1, amount: 5000 },
    ];

    const result = resizeOrganizationDonations(orgDonations, 2, 10000);

    expect(result).toEqual([
      { organizationId: 1, amount: 10000 },
    ]);
  });

  it('should handle complex rounding scenarios', () => {
    const orgDonations = [
      { organizationId: 1, amount: 100 },
      { organizationId: 2, amount: 200 },
      { organizationId: 3, amount: 300 },
    ];

    // Total: 600, multiply by 1.5 = 900, expect 900
    const result = resizeOrganizationDonations(orgDonations, 1.5, 900);

    const total = result.reduce((sum, org) => sum + org.amount, 0);
    expect(total).toBe(900);

    // Verify original objects not mutated
    expect(orgDonations[0].amount).toBe(100);
    expect(orgDonations[1].amount).toBe(200);
    expect(orgDonations[2].amount).toBe(300);
  });

  it('should preserve organization data while resizing', () => {
    const orgDonations = [
      { organizationId: 1, amount: 1000, name: 'Org A' },
      { organizationId: 2, amount: 2000, name: 'Org B' },
    ];

    const result = resizeOrganizationDonations(orgDonations, 0.5, 1500);

    expect(result[0].organizationId).toBe(1);
    expect(result[0].name).toBe('Org A');
    expect(result[1].organizationId).toBe(2);
    expect(result[1].name).toBe('Org B');
  });

  it('should handle discrepancy adjustment for negative differences', () => {
    const orgDonations = [
      { organizationId: 1, amount: 501 },
      { organizationId: 2, amount: 501 },
    ];

    // Multiplier 1, but expected total is 1000 (2 cents less than 1002)
    const result = resizeOrganizationDonations(orgDonations, 1, 1000);

    const total = result.reduce((sum, org) => sum + org.amount, 0);
    expect(total).toBe(1000);
  });
});
