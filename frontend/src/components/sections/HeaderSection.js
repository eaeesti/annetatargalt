import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import Button from "../elements/Button";
import Markdown from "../elements/Markdown";

function BackButton({ href, backWord }) {
  return (
    <Button type="text" size="sm" href={href} className="font-medium">
      <ChevronLeftIcon
        className="flex-shrink-0 mr-1 -ml-1 w-5 h-5"
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
            className="flex-shrink-0 mr-4 w-5 h-5"
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
          <span className="font-medium">{title}</span>
        )}
      </div>
    </li>
  );
}
export default function HeaderSection({
  title,
  subtitle,
  breadcrumbs,
  global,
}) {
  return (
    <div className="px-6 py-24 bg-white border-b lg:px-8 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-8 mx-auto lg:mx-0">
          {breadcrumbs.length > 1 && (
            <div className="text-slate-500">
              <nav className="flex sm:hidden" aria-label="Back">
                <BackButton
                  href={breadcrumbs[breadcrumbs.length - 1].href}
                  backWord={global.backWord}
                />
              </nav>
              <nav className="hidden sm:flex" aria-label="Breadcrumbs">
                <ol role="list" className="flex gap-4 items-center">
                  {breadcrumbs
                    .concat([{ title: title }])
                    .map((breadcrumb, index) => (
                      <Breadcrumb key={index} index={index} {...breadcrumb} />
                    ))}
                </ol>
              </nav>
            </div>
          )}
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            {title}
          </h2>
          {subtitle && (
            <Markdown className="w-full prose prose-lg" text={subtitle} />
          )}
        </div>
      </div>
    </div>
  );
}
