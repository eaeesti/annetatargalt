/**
 * Query parameters whose values must never be written to a log.
 *
 * `order-token` is the payment provider's signed order token, which arrives
 * on /api/confirm. Its payload carries the payer's name and IBAN.
 *
 * `token` is a donor's token for choosing their emails: whoever has it can
 * see their address and change what they get. Our own links don't put it in
 * a query string the backend gets, but a request can still come with one.
 *
 * `code` is what Google sends back to /google-login/callback, to exchange
 * for the account's ID token. It's useless without the login's PKCE
 * verifier, but it has no business in a log either.
 */
const REDACTED_QUERY_PARAMS = ["order-token", "token", "code"];

const REDACTED_PARAM_VALUE = new RegExp(
  `([?&](?:${REDACTED_QUERY_PARAMS.join("|")})=)[^&#]*`,
  "gi",
);

/** `url` with the value of every REDACTED_QUERY_PARAMS parameter blanked. */
export function redactUrl(url: string): string {
  return url.replace(REDACTED_PARAM_VALUE, "$1[redacted]");
}
