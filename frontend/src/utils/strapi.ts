// What both the browser and the server use to talk to Strapi. Content is
// fetched in cms.ts, which only the server can import.

export function getStrapiURL(path = ""): string {
  return `${
    process.env.NEXT_PUBLIC_STRAPI_API_URL || "http://127.0.0.1:1337"
  }${path}`;
}

/**
 * What to show the user when a request to Strapi fails: Strapi's own
 * "Name: message" when the body is a Strapi error, otherwise the HTTP status.
 * A body that isn't Strapi's is a proxy's error page, which means nothing to
 * a donor.
 */
export async function describeErrorResponse(
  response: Response,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    const error =
      typeof body === "object" && body !== null && "error" in body
        ? body.error
        : null;
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      "message" in error &&
      typeof error.name === "string" &&
      typeof error.message === "string"
    ) {
      return `${error.name}: ${error.message}`;
    }
  } catch {
    // Not JSON: fall through to the status.
  }
  return `${response.status} ${response.statusText}`.trim();
}

/** A response from Strapi that wasn't a success, with its HTTP status. */
export class StrapiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * The body of a response from our own Strapi, as the type the caller names.
 *
 * This is the one place the site trusts JSON without checking it: Strapi's
 * content API sends what the generated types in types/generated/strapi.ts
 * describe, and its custom endpoints (donations, stats) send what their
 * callers expect. Everything else read from outside, such as query strings,
 * browser storage or third parties, is read as unknown and narrowed instead.
 */
export function readStrapiJson<T>(response: Response): Promise<T> {
  return response.json();
}
