import { isRecord } from "./object";

// Switching language loads the other language's page from scratch, which
// starts at the top. These keep the visitor about as far down it as they were:
// the same share of the page, since a translation is a little longer or
// shorter than its original.

const KEY = "language-switch-scroll";

/** How long a kept position waits for its page to load. */
const MAX_AGE_MS = 10_000;

interface KeptScroll {
  path: string;
  share: number;
  at: number;
}

/** The kept share of the page, if it was kept for this path just now. */
export function keptShare(
  stored: string | null,
  path: string,
  now: number,
): number | null {
  let kept: unknown;
  try {
    kept = JSON.parse(stored ?? "");
  } catch {
    return null;
  }
  if (
    !isRecord(kept) ||
    kept.path !== path ||
    typeof kept.share !== "number" ||
    typeof kept.at !== "number" ||
    now - kept.at > MAX_AGE_MS ||
    kept.share < 0 ||
    kept.share > 1
  ) {
    return null;
  }
  return kept.share;
}

function scrollableHeight(): number {
  return document.documentElement.scrollHeight - window.innerHeight;
}

/** Keeps how far down this page is, for the page at href in another language. */
export function keepScrollFor(href: string): void {
  const height = scrollableHeight();
  const kept: KeptScroll = {
    path: new URL(href, window.location.href).pathname,
    share: height > 0 ? Math.min(1, window.scrollY / height) : 0,
    at: Date.now(),
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // the new page starts at the top
  }
}

/** Scrolls as far down as the page in the other language was, if it was. */
export function restoreKeptScroll(): void {
  let stored: string | null;
  try {
    stored = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
  const share = keptShare(stored, window.location.pathname, Date.now());
  if (share === null) return;

  const scroll = () => window.scrollTo({ top: share * scrollableHeight() });
  scroll();
  // Images and sections still loading can change the page's height; once
  // they're in, scroll again, unless the visitor already has.
  if (document.readyState !== "complete") {
    const scrolledTo = window.scrollY;
    window.addEventListener(
      "load",
      () => {
        if (Math.abs(window.scrollY - scrolledTo) < 2) scroll();
      },
      { once: true },
    );
  }
}
