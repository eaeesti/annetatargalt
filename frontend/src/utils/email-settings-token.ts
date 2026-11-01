/*
 * The token for the page where a donor chooses their emails. The links in
 * our emails put it in the address's fragment, which browsers never send, so
 * no server logs it. Once the page has it, it's taken out of the address, so
 * it isn't kept in the browser's history, or in a link copied from the page
 * or bookmarked: the tab keeps it instead, where a reload finds it and
 * closing the tab forgets it.
 */

const STORAGE_KEY = "emailSettingsToken";

/** What of the browser the token is read from and kept in. */
export interface TokenPlace {
  location: Pick<Location, "hash" | "pathname" | "search">;
  history: Pick<History, "replaceState">;
  /** The tab's storage, which a browser can refuse even to hand over. */
  storage: () => Pick<Storage, "getItem" | "setItem">;
}

function inAddress(hash: string): string | null {
  return new URLSearchParams(hash.slice(1)).get("token") || null;
}

/** The token: the address's, from a link just followed, or the tab's. */
export function currentToken({ location, storage }: TokenPlace): string | null {
  const fromLink = inAddress(location.hash);
  if (fromLink) return fromLink;
  try {
    return storage().getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Move the token from the address into the tab. It stays in the address when
 * the tab can't keep it, as in some private windows: a reload would lose it
 * otherwise.
 */
export function keepToken({ location, history, storage }: TokenPlace): void {
  const token = inAddress(location.hash);
  if (!token) return;
  try {
    storage().setItem(STORAGE_KEY, token);
  } catch {
    return;
  }
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}
