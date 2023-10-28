/**
 * Format a string with variables in it.
 * @param {string} string - The string containing <%= keys %> to replace.
 * @param {Object} values - The object with keys and values to use for formatting.
 * @return {string} - A formatted string.
 */
export function format(string, values) {
  return Object.entries(values).reduce(
    (previous, [key, value]) => previous.replace("<%= " + key + " %>", value),
    string,
  );
}
