"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/*
 * A list remembers its last address (filters, sort, page) for the rest of
 * the browser tab's session, so the "Donations" back link on a donation's page
 * returns to the list as it was left. The sidebar still opens a fresh list.
 */

function storageKey(path: string) {
  return `list-url:${path}`;
}

/** Keeps the address of the list at `path` up to date as its filters change. */
export function useRememberListUrl(path: string) {
  const query = useSearchParams().toString();
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey(path),
        query ? `${path}?${query}` : path,
      );
    } catch {
      // Storage can be off, e.g. in a private window; links then go to `path`.
    }
  }, [path, query]);
}

function rememberedUrl(path: string) {
  try {
    return sessionStorage.getItem(storageKey(path)) ?? path;
  } catch {
    return path;
  }
}

// Nothing to listen to: a list and the links back to it are never on the
// same page, so the stored address can't change while a link is showing.
function subscribe() {
  return () => {};
}

/** A link to the list at `href`, as it was last left. */
export function RememberedLink({
  href,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string }) {
  // The server can't see sessionStorage, so it renders plain `href` and the
  // browser swaps in the remembered address.
  const target = useSyncExternalStore(
    subscribe,
    () => rememberedUrl(href),
    () => href,
  );
  return <Link href={target} {...props} />;
}
