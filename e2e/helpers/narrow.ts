/** Whether a value read from JSON is an object, to look inside. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
