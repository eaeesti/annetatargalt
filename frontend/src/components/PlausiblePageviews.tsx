"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageview } from "@/utils/analytics";

/**
 * Counts a pageview in Plausible when the page's path changes. Its manual
 * script leaves that to us, so that it never sees the page's query string.
 */
export default function PlausiblePageviews() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageview();
  }, [pathname]);

  return null;
}
