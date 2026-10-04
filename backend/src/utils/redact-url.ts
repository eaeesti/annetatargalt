/**
 * Query parameters whose values must never be written to a log.
 *
 * `order-token` is the payment provider's signed order token, which arrives
 * on /api/confirm. Its payload carries the payer's name and IBAN.
 */
const REDACTED_QUERY_PARAMS = ["order-token"];

const REDACTED_PARAM_VALUE = new RegExp(
  `([?&](?:${REDACTED_QUERY_PARAMS.join("|")})=)[^&#]*`,
  "gi",
);

/** `url` with the value of every REDACTED_QUERY_PARAMS parameter blanked. */
export function redactUrl(url: string): string {
  return url.replace(REDACTED_PARAM_VALUE, "$1[redacted]");
}
