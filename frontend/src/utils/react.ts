export function classes(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(" ");
}

export const fetcher = (...args: Parameters<typeof fetch>): Promise<unknown> =>
  fetch(...args).then((res) => res.json());
