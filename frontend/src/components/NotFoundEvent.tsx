"use client";

import { useEffect } from "react";
import { usePlausible } from "next-plausible";

/**
 * Counts the visit in Plausible's "404" goal, which lists the paths that
 * were asked for: broken links, on the site or elsewhere, show up there.
 */
export default function NotFoundEvent() {
  const plausible = usePlausible();

  useEffect(() => {
    plausible("404");
  }, [plausible]);

  return null;
}
