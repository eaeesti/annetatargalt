import Markdown from "../elements/Markdown";
import Breadcrumbs from "../elements/Breadcrumbs";
import type { StrapiBreadcrumb, StrapiGlobal } from "@/types/generated/strapi";

interface HeaderSectionProps {
  title: string | null;
  subtitle?: string | null;
  breadcrumbs: StrapiBreadcrumb[];
  global: StrapiGlobal;
}

export default function HeaderSection({
  title,
  subtitle,
  breadcrumbs,
  global,
}: HeaderSectionProps) {
  return (
    <header className="bg-slate-100 px-4 py-24 sm:py-32 lg:px-8">
      <div className="container lg:max-w-3xl">
        <div className="mx-auto flex flex-col gap-8 lg:mx-0">
          <Breadcrumbs
            breadcrumbs={breadcrumbs}
            title={title}
            global={global}
          />
          <h1 className="text-4xl font-bold tracking-tight text-primary-700 sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <Markdown className="prose-md prose w-full max-w-3xl prose-primary">
              {subtitle}
            </Markdown>
          )}
        </div>
      </div>
    </header>
  );
}
