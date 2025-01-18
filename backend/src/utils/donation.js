function amountToCents(amount) {
  return Math.round(amount * 100);
}

function validateAmount(amount) {
  if (typeof amount !== "number") return false;

  return amount >= 100;
}

/**
 * Validate an Estonian ID code according to the specification at
 * https://et.wikipedia.org/wiki/Isikukood.
 * @param {string} idCode - An Estonian ID code, e.g. "49403136515".
 * @return {boolean} - Whether the idCode is valid or not.
 */
function validateIdCode(idCode) {
  if (!/[1-6]\d{2}[0-1]\d[0-3]\d{5}/.test(idCode)) return false;

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
 * Validate an email string.
 * @param {string} string - The string to validate.
 * @return {boolean} - Whether the string is a valid email.
 */
function validateEmail(string) {
  const emailRegex = new RegExp(
    /^(([^<>()\[\]\\.,;:\s@"]+(.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}])|(([a-zA-Z-0-9]+.)+[a-zA-Z]{2,}))$/
  );
  return emailRegex.test(string);
}

function resizeOrganizationDonations(
  organizationDonations,
  multiplier,
  expectedTotal
) {
  const resizedOrganizationDonations = organizationDonations.map(
    (organizationDonation) => {
      const amount = Math.round(organizationDonation.amount * multiplier);
      return { ...organizationDonation, amount };
    }
  );

  const resizedTotal = resizedOrganizationDonations.reduce(
    (prev, cur) => prev + cur.amount,
    0
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

module.exports = {
  amountToCents,
  validateAmount,
  validateIdCode,
  validateEmail,
  resizeOrganizationDonations,
};
