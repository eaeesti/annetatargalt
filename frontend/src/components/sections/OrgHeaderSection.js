import Breadcrumbs from "../elements/Breadcrumbs";
import Button from "../elements/Button";
import Image from "../elements/Image";

// This is not called OrganizationHeaderSection, because there is a limit of
// how long a postgres relation can be and Strapi said it was creating a
// duplicate relation.
export default function OrgHeaderSection({ breadcrumbs, entity, global }) {
  const cause = entity.cause.data.attributes;

  const breadcrumbsWithCause = [
    ...breadcrumbs,
    {
      title: cause.title,
      href: `/${cause.slug}`,
    },
  ];

  return (
    <header className="bg-slate-100">
      <div className="bg-slate-200 px-4 pb-40 pt-24 lg:px-8">
        <div className="container xl:max-w-5xl">
          <Breadcrumbs
            breadcrumbs={breadcrumbsWithCause}
            title={entity.title}
            backWord={global.backWord}
          />
        </div>
      </div>
      <div className="-mt-20 px-4 pb-16 lg:px-8">
        <div className="container flex flex-col items-center gap-16 md:items-start xl:max-w-5xl">
          <Image
            data={entity.logo}
            className="h-40 w-40 rounded-2xl shadow-lg"
          />
          <div className="flex w-full flex-col gap-8 text-center md:text-left lg:flex-row lg:justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-primary-700 md:text-4xl">
              {entity.title}
            </h1>
            <div className="flex flex-col-reverse justify-center gap-6 xs:flex-row-reverse xs:items-center md:justify-end lg:flex-row">
              {entity.homepage && (
                <Button
                  text="Koduleht"
                  href={entity.homepage}
                  type="text"
                  size="sm"
                  className="!gap-0.5 text-slate-600"
                  newTab
                />
              )}
              <Button
                text="Anneta"
                href={`${global.donateLink}?org=${entity.internalId}`}
                type="primary"
                size="lg"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
