import HeaderSection from "./HeaderSection";

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
    <HeaderSection
      title={entity.title}
      subtitle={entity.introduction}
      breadcrumbs={breadcrumbsWithCause}
      global={global}
    />
  );
}
