export interface OrganizationDonation {
  amount: number;
  organizationInternalId: string;
}

/**
 * Convert an amount in euros to cents.
 */
export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Validate a donation amount: whole cents, at least 1.00 EUR.
 */
export function validateAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 100;
}

/**
 * Validate an Estonian ID code according to the specification at
 * https://et.wikipedia.org/wiki/Isikukood.
 * @param idCode - An Estonian ID code, e.g. "49403136515".
 * @returns Whether the idCode is valid or not.
 */
export function validateIdCode(idCode: string): boolean {
  if (!/^[1-6]\d{2}[0-1]\d[0-3]\d{5}$/.test(idCode)) return false;

  const digits = Array.from(idCode).map(Number);
  const lastDigit = digits.slice(-1)[0];
  const otherDigits = digits.slice(0, 10);
  const weights1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1];
  const modulo1 =
    otherDigits.reduce((prev, cur, i) => prev + cur * weights1[i], 0) % 11;
  if (modulo1 < 10) return lastDigit === modulo1;

  const weights2 = [3, 4, 5, 6, 7, 8, 9, 1, 2, 3];
  const modulo2 =
    otherDigits.reduce((prev, cur, i) => prev + cur * weights2[i], 0) % 11;
  return lastDigit === modulo2 % 10;
}

/**
 * Whether a string is an email address we send to: letters, digits and the
 * usual symbols before the @, in parts joined by single dots, and a domain
 * name with a top-level domain of two letters or more. Quoted local parts,
 * comments and IP addresses as domains are valid in the standard but not
 * from a donation form, and they're what mail libraries' address parsers
 * have had bugs with.
 */
export function validateEmail(string: string): boolean {
  const local = /[^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*/.source;
  const domain = /([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/.source;
  return (
    string.length <= 254 && new RegExp(`^${local}@${domain}$`).test(string)
  );
}

/**
 * Resize organization donations by a multiplier, ensuring total matches expected.
 * Handles rounding discrepancies by adjusting last donations.
 */
export function resizeOrganizationDonations(
  organizationDonations: OrganizationDonation[],
  multiplier: number,
  expectedTotal: number,
): OrganizationDonation[] {
  const resizedOrganizationDonations = organizationDonations.map(
    (organizationDonation) => {
      const amount = Math.round(organizationDonation.amount * multiplier);
      return { ...organizationDonation, amount };
    },
  );

  const resizedTotal = resizedOrganizationDonations.reduce(
    (prev, cur) => prev + cur.amount,
    0,
  );

  if (resizedTotal !== expectedTotal) {
    const discrepancy = expectedTotal - resizedTotal;
    const timesToAdd = Math.abs(discrepancy);
    const adder = discrepancy / timesToAdd;

    for (let i = 0; i < timesToAdd; i++) {
      const index = resizedOrganizationDonations.length - 1 - i;
      resizedOrganizationDonations[index].amount += adder;
    }
  }

  return resizedOrganizationDonations;
}
