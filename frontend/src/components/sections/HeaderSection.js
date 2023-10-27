import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import Button from "../elements/Button";
import Markdown from "../elements/Markdown";

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

export default function HeaderSection({
  title,
  subtitle,
  breadcrumbs,
  global,
}) {
  return (
    <div className="bg-slate-100 px-4 py-24 sm:py-32 lg:px-8">
      <div className="container">
        <div className="mx-auto flex flex-col gap-8 lg:mx-0">
          {breadcrumbs.length > 0 && (
            <div className="text-slate-500">
              <nav className="flex sm:hidden" aria-label="Back">
                <BackButton
                  href={breadcrumbs[breadcrumbs.length - 1].href}
                  backWord={global.backWord}
                />
              </nav>
              <nav className="hidden sm:flex" aria-label="Breadcrumbs">
                <ol role="list" className="flex items-center gap-4">
                  {breadcrumbs
                    .concat([{ title: title }])
                    .map((breadcrumb, index) => (
                      <Breadcrumb key={index} index={index} {...breadcrumb} />
                    ))}
                </ol>
              </nav>
            </div>
          )}
          <h2 className="text-4xl font-bold tracking-tight text-primary-700 sm:text-5xl">
            {title}
          </h2>
          {subtitle && (
            <Markdown className="prose-md prose prose-primary w-full max-w-3xl">
              {subtitle}
            </Markdown>
          )}
        </div>
      </div>
    </div>
  );
}
