import Organization from "../elements/Organization";
import type { StrapiCause, StrapiCauseOrganizationsSection, StrapiGlobal } from "@/types/generated/strapi";

interface CauseOrganizationsSectionProps extends StrapiCauseOrganizationsSection {
  entity: StrapiCause;
  global: StrapiGlobal;
}

export default function CauseOrganizationsSection({
  recommendedFundTitle,
  recommendedOrganizationsTitle,
  entity,
  global,
}: CauseOrganizationsSectionProps) {
  const organizationsWithFund = entity.organizations || [];

  const organizations = organizationsWithFund.filter(
    (organization) => !organization.fund,
  );

  const fund = organizationsWithFund.find((organization) => organization.fund);

  return (
    <section className="bg-slate-200 py-24">
      <div className="container flex flex-col items-center gap-24">
        <h2 className="inline-block max-w-full break-words px-4 text-center text-2xl font-semibold tracking-tight text-primary-700 xs:text-2xl xs:font-bold sm:text-3xl">
          {recommendedFundTitle}
        </h2>
        {fund && (
          <div className="w-full xs:px-4">
            <Organization
              id={fund.id}
              organization={fund}
              donateButtonText={global.donateText}
              donateLink={global.donateLink}
              readMoreText={global.readMoreText}
              organizationLink={`/${entity.slug}/${fund.slug}`}
            />
          </div>
        )}
        <h2 className="mt-12 inline-block max-w-full break-words px-4 text-center text-2xl font-semibold tracking-tight text-primary-700 xs:text-2xl xs:font-bold sm:text-3xl">
          {recommendedOrganizationsTitle}
        </h2>
        <div className="grid grid-cols-1 justify-center gap-8 xs:px-4 lg:grid-cols-2 xl:grid-cols-3">
          {organizations.map((organization) => (
            <Organization
              key={organization.id}
              id={organization.id}
              organization={organization}
              donateButtonText={global.donateText}
              donateLink={global.donateLink}
              readMoreText={global.readMoreText}
              organizationLink={`/${entity.slug}/${organization.slug}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
