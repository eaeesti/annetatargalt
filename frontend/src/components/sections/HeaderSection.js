import Markdown from "../elements/Markdown";
import Breadcrumbs from "../elements/Breadcrumbs";

export default function HeaderSection({
  title,
  subtitle,
  breadcrumbs,
  global,
}) {
  return (
    <div className="bg-slate-100 px-4 py-24 sm:py-32 lg:px-8">
      <div className="container xl:max-w-5xl">
        <div className="mx-auto flex flex-col gap-8 lg:mx-0">
          <Breadcrumbs
            breadcrumbs={breadcrumbs}
            title={title}
            backWord={global.backWord}
          />
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
