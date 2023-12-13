function urlWithParams(url, params) {
  return `${url}?${new URLSearchParams(params)}`;
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
