"use client";

import Link from "next/link";
import ExternalLinkIcon from "../icons/ExternalLinkIcon";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useRef } from "react";

export default function Anchor({
  className,
  href,
  newTab = false,
  noIcon = false,
  children,
  ...rest
}) {
  // Overwrite the default id that Next.js generates for the <a> tag
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.id = uuidv4();
  }, []);

  return (
    <Link
      ref={ref}
      href={href}
      target={newTab ? "_blank" : "_self"}
      rel={newTab ? "noopener noreferrer" : ""}
      prefetch={newTab ? false : true}
      className={className}
      {...rest}
    >
      {children}
      {newTab && !noIcon && (
        <>
          <span className="sr-only">(opens in new tab)</span>
          <ExternalLinkIcon className="ml-1 inline h-4 w-4" />
        </>
      )}
    </Link>
  );
}
