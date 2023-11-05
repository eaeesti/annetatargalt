/**
 * Validate an Estonian ID code according to the specification at
 * https://et.wikipedia.org/wiki/Isikukood.
 * @param {string} idCode - An Estonian ID code, e.g. "49403136515".
 * @return {boolean} - Whether the idCode is valid or not.
 */
export function validateIdCode(idCode) {
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
