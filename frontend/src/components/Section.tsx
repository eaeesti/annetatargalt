import { strapiSectionNameToReactComponentName } from "@/utils/strapi";
import type { StrapiSection, StrapiGlobal, StrapiPage, StrapiSpecialPage, StrapiCause, StrapiOrganization, StrapiBlogPost } from "@/types/generated/strapi";

interface SectionProps {
  section: StrapiSection;
  global: StrapiGlobal;
  page: StrapiPage | StrapiSpecialPage;
  entity?: StrapiCause | StrapiOrganization | StrapiBlogPost;
}

export default function Section({ section, global, entity, page }: SectionProps) {
  const componentName = strapiSectionNameToReactComponentName(
    section.__component
  );
  // One permanent cast — Section.tsx never needs updating for new sections
  const mod = require(`./sections/${componentName}`) as { default: React.ComponentType<Record<string, unknown>> };
  const Component = mod.default;

  return <Component {...(section as unknown as Record<string, unknown>)} global={global} entity={entity} page={page} />;
}
