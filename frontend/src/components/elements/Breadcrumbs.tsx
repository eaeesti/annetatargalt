import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import Button from "../elements/Button";
import { classes } from "@/utils/react";
import type { StrapiBreadcrumb, StrapiGlobal } from "@/types/generated/strapi";
import { localeOf } from "@/utils/locale";
import { uiText } from "@/utils/ui-text";

interface BackButtonProps {
  href: string;
  backWord: string | null;
}

function BackButton({ href, backWord }: BackButtonProps) {
  return (
    <Button type="text" size="sm" href={href} className="font-medium">
      <ChevronLeftIcon
        className="mr-1 -ml-1 h-5 w-5 shrink-0"
        aria-hidden="true"
      />
      {backWord}
    </Button>
  );
}

interface BreadcrumbItemProps {
  index: number;
  title: string | null;
  href?: string | null;
}

function BreadcrumbItem({ index, title, href }: BreadcrumbItemProps) {
  return (
    <li>
      <div className="flex items-center">
        {index > 0 && (
          <ChevronRightIcon
            className="mr-4 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
        )}
        {href ? (
          <Button
            text={title}
            type="text"
            size="sm"
            href={href}
            className="font-medium"
          />
        ) : (
          <span className="font-semibold">{title}</span>
        )}
      </div>
    </li>
  );
}

interface BreadcrumbsProps {
  breadcrumbs: StrapiBreadcrumb[];
  title: string | null;
  global: StrapiGlobal;
  className?: string;
}

export default function Breadcrumbs({
  breadcrumbs,
  title,
  global,
  className = "",
}: BreadcrumbsProps) {
  if (!breadcrumbs || !breadcrumbs.length) return;

  const { backWord } = global;

  return (
    <div className={classes("text-sm text-slate-600", className)}>
      <nav className="flex md:hidden" aria-label={backWord ?? undefined}>
        <BackButton
          href={breadcrumbs[breadcrumbs.length - 1].href ?? "/"}
          backWord={backWord}
        />
      </nav>
      <nav
        className="hidden md:flex"
        aria-label={uiText(localeOf(global)).breadcrumbs}
      >
        <ol role="list" className="flex flex-wrap items-center gap-4">
          {breadcrumbs
            .concat([{ id: -1, title: title, href: null }])
            .map((breadcrumb, index) => (
              <BreadcrumbItem
                key={index}
                index={index}
                title={breadcrumb.title ?? ""}
                href={breadcrumb.href}
              />
            ))}
        </ol>
      </nav>
    </div>
  );
}
