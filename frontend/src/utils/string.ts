/**
 * Format a string with variables in it.
 * @example
 * format("Hello <%= name %>", { name: "World" }); // "Hello World"
 */
export function format(string: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (previous, [key, value]) => previous.replace("<%= " + key + " %>", value),
    string,
  );
}

/**
 * Validate a price string.
 * Approves of "1", "1.23", "1,23", "1.2", "123" etc.
 * Disapproves of "1.", "1,", "1.234", "0.23", "0", "01", "", "hehe" etc.
 */
export function validatePrice(string: string): boolean {
  const priceRegex = new RegExp(/^[1-9](\d+)?([.,]\d{1,2})?$/);
  return priceRegex.test(string);
}

/**
 * Validate an email string.
 */
export function validateEmail(string: string): boolean {
  const emailRegex = new RegExp(
    /^(([^<>()\[\]\\.,;:\s@"]+(.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}])|(([a-zA-Z-0-9]+.)+[a-zA-Z]{2,}))$/,
  );
  return emailRegex.test(string);
}
