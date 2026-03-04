/**
 * Construct a URL with query parameters.
 * Spaces are converted to %20.
 */
export function urlWithParams(url: string, params: Record<string, string | number>): string {
  const paramsString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `${url}?${paramsString}`;
}

/**
 * Format a string with variables in it.
 * @example
 * format("Hello <%= name %>", { name: "World" }); // "Hello World"
 */
export function format(string: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (previous, [key, value]) => previous.replace("<%= " + key + " %>", value),
    string
  );
}

/**
 * Convert plain text into HTML paragraphs.
 */
export function textIntoParagraphs(text: string | null | undefined): string {
  if (!text) return "";
  const lines = text.split("\n");
  return lines.map((line) => `<p>${line}</p>`).join("\n");
}

/**
 * Sanitize HTML string to prevent XSS attacks.
 */
export function sanitize(string: string): string {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
