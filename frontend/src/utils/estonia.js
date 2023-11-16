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

/**
 * Format a number to a valid Estonian number string.
 * @param {number} number - The number to format.
 * @return {string} - A formatted number string.
 * @example
 * formatEstonianAmount(1234.56); // "1 234,56"
 * formatEstonianAmount(1234); // "1 234"
 * formatEstonianAmount(1234.5); // "1 234,5"
 */
export function formatEstonianAmount(number) {
  const withCents = formatEstonianAmountWithCents(number);
  return withCents.replace(/,00$/, "");
}

export function formatEstonianAmountWithCents(number) {
  const asString = String(number);
  const [integerPart, decimalPart] = asString.split(".");
  const integerWithSpaces = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const decimal = decimalPart ? "," + decimalPart.padEnd(2, "0") : ",00";

  const estonianAmount = integerWithSpaces + decimal;
  return estonianAmount;
}
