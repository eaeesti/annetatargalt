import { readStrapiJson } from "./strapi";

export function classes(
  ...args: (string | false | null | undefined)[]
): string {
  return args.filter(Boolean).join(" ");
}

/**
 * SWR's fetcher for Strapi's own endpoints. The body is the type the useSWR
 * call names, trusted the same way as in readStrapiJson.
 */
export function fetcher<T>(...args: Parameters<typeof fetch>): Promise<T> {
  return fetch(...args).then((res) => readStrapiJson<T>(res));
}
