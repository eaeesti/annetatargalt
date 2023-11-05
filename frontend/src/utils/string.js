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
 */
export function validateEmail(string) {
  const emailRegex = new RegExp(
    /^(([^<>()\[\]\\.,;:\s@"]+(.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}])|(([a-zA-Z-0-9]+.)+[a-zA-Z]{2,}))$/,
  );
  return emailRegex.test(string);
}
