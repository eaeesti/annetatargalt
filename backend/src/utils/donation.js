function amountToCents(amount) {
  return Math.round(amount * 100);
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

function amountsFromProportions(proportions, totalAmount) {
  const amountsAndProportions = {};

  for (let [_, cause] of Object.entries(proportions)) {
    for (let [orgId, org] of Object.entries(cause.proportions)) {
      const proportion = (cause.proportion * org.proportion) / 10000;
      const amount = Math.round(totalAmount * proportion);
      amountsAndProportions[orgId] = { amount, proportion };
    }
  }

  const total = Object.values(amountsAndProportions)
    .map((value) => value.amount)
    .reduce((a, b) => a + b, 0);
  if (total !== totalAmount) {
    const discrepancy = Math.round(totalAmount - total);
    const timesToAdd = Math.abs(discrepancy);
    const adder = discrepancy / timesToAdd;

    const keys = Object.keys(amountsAndProportions);
    for (let i = 0; i < timesToAdd; i++) {
      const key = keys.at(-(i % keys.length) - 1);
      amountsAndProportions[key].amount = Math.round(
        amountsAndProportions[key].amount + adder
      );
    }
  }

  return amountsAndProportions;
}

module.exports = {
  amountToCents,
  validateAmount,
  validateIdCode,
  validateEmail,
  amountsFromProportions,
};
