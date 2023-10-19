import Link from "next/link";

export default function Anchor({ className, href, newTab, children }) {
  return (
    <Link
      href={href}
      target={newTab ? "_blank" : "_self"}
      rel={newTab ? "noopener noreferrer" : ""}
      className={className}
    >
      {children}
    </Link>
  );
}
