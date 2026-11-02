"use client";

import { useEffect } from "react";
import { track } from "@/utils/analytics";

/**
 * Counts the visit as "page:not-found". The event carries the page's address,
 * so its pages in the analytics list the broken links, on the site or
 * elsewhere.
 */
export default function NotFoundEvent() {
  useEffect(() => {
    track("page:not-found");
  }, []);

  return null;
}
