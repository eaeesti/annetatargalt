import HeaderSection from "./HeaderSection";
import type { StrapiGlobal, StrapiSpecialHeaderSection } from "@/types/generated/strapi";

interface SpecialHeaderSectionProps extends StrapiSpecialHeaderSection {
  entity: Record<string, unknown>;
  global: StrapiGlobal;
}

export default function SpecialHeaderSection({
  entity,
  descriptionField,
  breadcrumbs,
  global,
}: SpecialHeaderSectionProps) {
  return (
    <HeaderSection
      title={entity.title as string}
      subtitle={descriptionField ? entity[descriptionField] as string : null}
      breadcrumbs={breadcrumbs}
      global={global}
    />
  );
}
