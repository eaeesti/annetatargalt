/**
 * Construct a URL with query parameters.
 * Spaces are converted to %20.
 * @param {string} url - The base URL.
 * @param {Object} params - The query parameters as key-value pairs.
 * @return {string} - The URL with query parameters.
 */
function urlWithParams(url, params) {
  const paramsString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `${url}?${paramsString}`;
}

/**
 * Format a string with variables in it.
 * @param {string} string - The string containing <%= keys %> to replace.
 * @param {Object} values - The object with keys and values to use for formatting.
 * @return {string} - A formatted string.
 * @example
 * format("Hello <%= name %>", { name: "World" }); // "Hello World"
 */
function format(string, values) {
  return Object.entries(values).reduce(
    (previous, [key, value]) => previous.replace("<%= " + key + " %>", value),
    string
  );
}

function textIntoParagraphs(text) {
  if (!text) return "";
  const lines = text.split("\n");
  return lines.map((line) => `<p>${line}</p>`).join("\n");
}

function sanitize(string) {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  urlWithParams,
  format,
  textIntoParagraphs,
  sanitize,
};
