import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import Button from "../elements/Button";
import { classes } from "@/utils/react";

function BackButton({ href, backWord }) {
  return (
    <Button type="text" size="sm" href={href} className="font-medium">
      <ChevronLeftIcon
        className="-ml-1 mr-1 h-5 w-5 flex-shrink-0"
        aria-hidden="true"
      />
      {backWord}
    </Button>
  );
}

function Breadcrumb({ index, title, href }) {
  return (
    <li>
      <div className="flex items-center">
        {index > 0 && (
          <ChevronRightIcon
            className="mr-4 h-5 w-5 flex-shrink-0"
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

export default function Breadcrumbs({
  breadcrumbs,
  title,
  backWord,
  className = "",
}) {
  if (!breadcrumbs.length) return;

  return (
    <div className={classes("text-sm text-slate-600", className)}>
      <nav className="flex md:hidden" aria-label="Back">
        <BackButton
          href={breadcrumbs[breadcrumbs.length - 1].href}
          backWord={backWord}
        />
      </nav>
      <nav className="hidden md:flex" aria-label="Breadcrumbs">
        <ol role="list" className="flex flex-wrap items-center gap-4">
          {breadcrumbs.concat([{ title: title }]).map((breadcrumb, index) => (
            <Breadcrumb key={index} index={index} {...breadcrumb} />
          ))}
        </ol>
      </nav>
    </div>
  );
}
