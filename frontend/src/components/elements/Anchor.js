import Link from "next/link";
import ExternalLinkIcon from "../icons/ExternalLinkIcon";

export default function Anchor({
  className,
  href,
  newTab = false,
  noIcon = false,
  children,
  ...rest
}) {
  return (
    <Link
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
