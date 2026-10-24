import HeaderSection from "./HeaderSection";
import { stringField } from "@/utils/object";
import type {
  StrapiBlogPost,
  StrapiCause,
  StrapiGlobal,
  StrapiOrganization,
  StrapiSpecialHeaderSection,
} from "@/types/generated/strapi";

interface SpecialHeaderSectionProps extends StrapiSpecialHeaderSection {
  entity: StrapiCause | StrapiOrganization | StrapiBlogPost;
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
      title={entity.title}
      subtitle={descriptionField ? stringField(entity, descriptionField) : null}
      breadcrumbs={breadcrumbs}
      global={global}
    />
  );
}
