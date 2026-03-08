import { format } from "@/utils/string";
import CtaSection from "./CtaSection";
import type { StrapiGlobal, StrapiOrganization, StrapiOrganizationCtaSection } from "@/types/generated/strapi";

interface OrganizationCtaSectionProps extends StrapiOrganizationCtaSection {
  entity: StrapiOrganization;
  global: StrapiGlobal;
}

export default function OrganizationCtaSection({
  title,
  description,
  donateText,
  entity,
  global,
}: OrganizationCtaSectionProps) {
  const buttonText = format(donateText ?? "", {
    title: entity.title ?? "",
  });

  return (
    <CtaSection
      title={title}
      description={description}
      buttons={[
        {
          id: 0,
          text: buttonText,
          href: `${global.donateLink}?org=${entity.internalId}`,
          type: "white",
          size: "lg",
          arrow: null,
          newTab: null,
          plausibleEvent: null,
        },
      ]}
    />
  );
}
