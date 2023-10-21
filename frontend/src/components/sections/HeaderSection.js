import ReactMarkdown from "react-markdown";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import Link from "next/link";

function BackButton({ href }) {
  return (
    <Link
      href={href}
      className="flex items-center font-medium text-slate-500 hover:text-slate-400"
    >
      <ChevronLeftIcon
        className="flex-shrink-0 mr-1 -ml-1 w-5 h-5 text-slate-500"
        aria-hidden="true"
      />
      {/* TODO: Get from Strapi */}
      Tagasi
    </Link>
  );
}

function Breadcrumb({ index, title, href }) {
  return (
    <li>
      <div className="flex items-center">
        {index > 0 && (
          <ChevronRightIcon
            className="flex-shrink-0 mr-4 w-5 h-5 text-slate-500"
            aria-hidden="true"
          />
        )}
        {href ? (
          <Link
            href={href}
            className="font-medium text-slate-500 hover:text-slate-400"
          >
            {title}
          </Link>
        ) : (
          <span className="font-medium text-slate-500">{title}</span>
        )}
      </div>
    </li>
  );
}
export default function HeaderSection({ data }) {
  return (
    <div className="py-24 bg-white sm:py-32">
      <div className="px-6 mx-auto max-w-7xl lg:px-8">
        <div className="flex flex-col gap-8 mx-auto max-w-2xl lg:mx-0">
          {data.breadcrumbs.length > 1 && (
            <div>
              <nav className="sm:hidden" aria-label="Back">
                <BackButton
                  href={data.breadcrumbs[data.breadcrumbs.length - 1].href}
                />
              </nav>
              <nav className="hidden sm:flex" aria-label="Breadcrumbs">
                <ol role="list" className="flex gap-4 items-center">
                  {data.breadcrumbs
                    .concat([{ title: data.title }])
                    .map((breadcrumb, index) => (
                      <Breadcrumb key={index} index={index} {...breadcrumb} />
                    ))}
                </ol>
              </nav>
            </div>
          )}
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            {data.title}
          </h2>
          {data.subtitle && (
            <ReactMarkdown
              className="w-full max-w-2xl text-slate-600 prose-lg"
              children={data.subtitle}
            />
          )}
        </div>
      </div>
    </div>
  );
}
