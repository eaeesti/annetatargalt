import { useState } from "react";
import Button from "../Button";
import Organization from "../Organization";
import { pagePath, type Locale } from "@/utils/locale";
import type { StrapiIncomeCalculatorSection } from "@/types/generated/strapi";

interface RecommendedOrganizationsProps {
  section: StrapiIncomeCalculatorSection;
  donateLink: string | null;
  locale: Locale;
}

/**
 * The active organizations in each of the section's causes, a button for each
 * cause. As on a cause's page, its fund comes first.
 */
export default function RecommendedOrganizations({
  section,
  donateLink,
  locale,
}: RecommendedOrganizationsProps) {
  const causes = section.causes
    .map((cause) => ({
      cause,
      organizations: cause.organizations
        .filter((organization) => organization.active)
        .sort(
          (a, b) =>
            Number(Boolean(b.fund)) - Number(Boolean(a.fund)) ||
            (a.title ?? "").localeCompare(b.title ?? "", locale),
        ),
    }))
    .filter(({ organizations }) => organizations.length > 0);
  const [chosen, setChosen] = useState(0);
  const shown = causes[chosen] ?? causes[0];
  if (!shown) return null;

  return (
    <section className="bg-slate-200 py-20 sm:py-24">
      <div className="container flex flex-col gap-8">
        <div className="flex flex-col gap-3 px-4">
          <h2 className="text-2xl font-bold tracking-tight text-balance text-primary-700 xs:text-3xl sm:text-4xl">
            {section.organizationsTitle}
          </h2>
          <p className="max-w-2xl text-pretty text-slate-600 sm:text-lg">
            {section.organizationsSubtitle}
          </p>
        </div>
        {/* A row that scrolls sideways on phones, and wraps on wider screens. */}
        {causes.length > 1 && (
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {causes.map(({ cause, organizations }, index) => (
              <Button
                key={cause.id}
                text={`${cause.title} (${organizations.length})`}
                type={index === chosen ? "primary" : "white"}
                className="shrink-0 whitespace-nowrap"
                onClick={() => setChosen(index)}
              />
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 justify-center gap-8 xs:px-4 lg:grid-cols-2 xl:grid-cols-3">
          {shown.organizations.map((organization) => (
            <Organization
              key={organization.id}
              id={organization.id}
              organization={organization}
              donateButtonText={section.donateText}
              donateLink={donateLink}
              readMoreText={section.readMoreText}
              organizationLink={pagePath(
                `${shown.cause.slug}/${organization.slug}`,
                locale,
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
