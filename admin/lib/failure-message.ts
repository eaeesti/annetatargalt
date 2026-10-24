/** What to say when a request couldn't reach the server at all. */
export const CONNECTION_FAILED =
  "That didn't go through. Check your connection and try again.";

/** The backend's message for a failed request, or `fallback` if it gave none. */
export async function failureMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return fallback;
  }
  const { error } = body;
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}
