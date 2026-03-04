"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitize = exports.textIntoParagraphs = exports.format = exports.urlWithParams = void 0;
/**
 * Construct a URL with query parameters.
 * Spaces are converted to %20.
 */
function urlWithParams(url, params) {
    const paramsString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");
    return `${url}?${paramsString}`;
}
exports.urlWithParams = urlWithParams;
/**
 * Format a string with variables in it.
 * @example
 * format("Hello <%= name %>", { name: "World" }); // "Hello World"
 */
function format(string, values) {
    return Object.entries(values).reduce((previous, [key, value]) => previous.replace("<%= " + key + " %>", value), string);
}
exports.format = format;
/**
 * Convert plain text into HTML paragraphs.
 */
function textIntoParagraphs(text) {
    if (!text)
        return "";
    const lines = text.split("\n");
    return lines.map((line) => `<p>${line}</p>`).join("\n");
}
exports.textIntoParagraphs = textIntoParagraphs;
/**
 * Sanitize HTML string to prevent XSS attacks.
 */
function sanitize(string) {
    return string
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
exports.sanitize = sanitize;
