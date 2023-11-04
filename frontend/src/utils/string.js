/**
 * Format a string with variables in it.
 * @param {string} string - The string containing <%= keys %> to replace.
 * @param {Object} values - The object with keys and values to use for formatting.
 * @return {string} - A formatted string.
 * @example
 * format("Hello <%= name %>", { name: "World" }); // "Hello World"
 */
export function format(string, values) {
  return Object.entries(values).reduce(
    (previous, [key, value]) => previous.replace("<%= " + key + " %>", value),
    string,
  );
}

/**
 * Validate a price string.
 * Should start with a non-zero digit.
 * Optionally followed by any number of digits.
 * Optionally followed by a dot or comma, which then must be followed by one or two digits.
 * Approves of "1", "1.23", "1,23", "1.2", "123" etc.
 * Disapproves of "1.", "1,", "1.234", "0.23", "0", "01", "", "hehe" etc.
 * @param {string} string - The string to validate.
 * @return {boolean} - Whether the string is a valid price.
 * @example
 * validatePrice("1.23"); // true
 * validatePrice("1.234"); // false
 */
export function validatePrice(string) {
  const priceRegex = new RegExp(/^[1-9](\d+)?([.,]\d{1,2})?$/);
  return priceRegex.test(string);
}

/**
 * Validate an email string.
 * @param {string} string - The string to validate.
 * @return {boolean} - Whether the string is a valid email.
 * @example
 * validateEmail("a@b.c"); // true
 * validateEmail("a@b"); // true
 * validateEmail("a@"); // false
 * validateEmail("@b.c"); // false
 * validateEmail("a@b@c"); // false
 * validateEmail("hehe"); // false
 * validateEmail(""); // false
 * validateEmail("a b@c"); // false
 */
export function validateEmail(string) {
  const emailRegex = new RegExp(/^[^@\s]+@[^@\s]+$/);
  return emailRegex.test(string);
}

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
