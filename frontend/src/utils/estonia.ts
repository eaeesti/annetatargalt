/**
 * Validate an Estonian ID code according to the specification at
 * https://et.wikipedia.org/wiki/Isikukood.
 */
export function validateIdCode(idCode: string): boolean {
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
 * @example
 * formatEstonianAmount(1234.56); // "1234,56"
 * formatEstonianAmount(1234);    // "1234"
 * formatEstonianAmount(12345);   // "12 345"
 */
export function formatEstonianAmount(number: number): string {
  const withCents = formatEstonianAmountWithCents(number);
  return withCents.replace(/,00$/, "");
}

export function formatEstonianAmountWithCents(number: number): string {
  const asString = String(number);
  const [integerPart, decimalPart] = asString.split(".");
  const integerWithSpaces =
    integerPart.length >= 5
      ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
      : integerPart;
  const decimal = decimalPart ? "," + decimalPart.padEnd(2, "0") : ",00";

  return integerWithSpaces + decimal;
}
