import { getOrganizations } from "@/utils/strapi";
import Organization from "../elements/Organization";
import type {
  StrapiGlobal,
  StrapiOrganizationsSection,
} from "@/types/generated/strapi";
import { localeOf, pagePath } from "@/utils/locale";

interface OrganizationsSectionProps extends StrapiOrganizationsSection {
  global: StrapiGlobal;
}

export default async function OrganizationsSection({
  global,
}: OrganizationsSectionProps) {
  const locale = localeOf(global);
  const organizations = await getOrganizations(locale);

  return (
    <section className="bg-slate-200 py-24">
      <div className="container">
        <div className="grid grid-cols-1 justify-center gap-8 xs:px-4 lg:grid-cols-2 xl:grid-cols-3">
          {organizations.map((organization) => (
            <Organization
              key={organization.id}
              id={organization.id}
              organization={organization}
              donateButtonText={global.donateText}
              donateLink={global.donateLink}
              readMoreText={global.readMoreText}
              organizationLink={pagePath(
                `${organization.cause?.slug}/${organization.slug}`,
                locale,
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
