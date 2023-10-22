import Link from "next/link";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
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
      className={className}
      {...rest}
    >
      {children}
      {newTab && !noIcon && (
        <ExternalLinkIcon className="inline ml-1 w-4 h-4" />
      )}
    </Link>
  );
}
