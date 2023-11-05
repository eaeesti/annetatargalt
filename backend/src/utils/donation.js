function amountToCents(amount) {
  return Math.floor(amount * 100);
}

function validateAmount(amount) {
  if (typeof amount !== "number") return false;

  return amountToCents(amount) >= 100;
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

function validateDonation(donation) {
  if (!donation) {
    return { valid: false, reason: "No donation provided" };
  }

  if (!donation.firstName) {
    return { valid: false, reason: "No first name provided" };
  }

  if (!donation.lastName) {
    return { valid: false, reason: "No last name provided" };
  }

  if (!donation.idCode) {
    return { valid: false, reason: "No ID code provided" };
  }

  if (!validateIdCode(donation.idCode)) {
    return { valid: false, reason: `Invalid ID code: ${donation.idCode}` };
  }

  if (!donation.email) {
    return { valid: false, reason: "No email provided" };
  }

  if (!validateEmail(donation.email)) {
    return { valid: false, reason: `Invalid email: ${donation.email}` };
  }

  if (!donation.amount) {
    return { valid: false, reason: "No amount provided" };
  }

  if (!validateAmount(donation.amount)) {
    return { valid: false, reason: `Invalid amount: ${donation.amount}` };
  }

  if (!donation.type) {
    return { valid: false, reason: "No donation type provided" };
  }

  if (!["recurring", "onetime"].includes(donation.type)) {
    return {
      valid: false,
      reason: `Invalid donation type: ${donation.type}`,
    };
  }

  return { valid: true };
}

module.exports = {
  validateDonation,
  amountToCents,
};
