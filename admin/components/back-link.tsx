import { ArrowLeft } from "lucide-react";
import { RememberedLink } from "./remembered-link";

/** The link above a page's heading, back to the list as it was left. */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <RememberedLink
      href={href}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      {children}
    </RememberedLink>
  );
}
