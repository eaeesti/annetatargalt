export function classes(...classes) {
  return classes.filter(Boolean).join(" ");
}

export const fetcher = (...args) => fetch(...args).then((res) => res.json());
