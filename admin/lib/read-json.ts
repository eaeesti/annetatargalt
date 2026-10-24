/**
 * A response's JSON as the type the caller names.
 *
 * The admin trusts its own backend, and its own /api routes, which pass the
 * backend's answers on, to send what the backend's types say. This is the one
 * place that trust is spelled out, instead of a cast at every call. Anything
 * from outside, like a request body or Google's reply, is checked instead.
 */
export async function readJson<T>(res: Response): Promise<T> {
  return res.json();
}
