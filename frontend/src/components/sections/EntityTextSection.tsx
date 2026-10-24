import TextSection from "./TextSection";
import { stringField } from "@/utils/object";
import type {
  StrapiBlogPost,
  StrapiCause,
  StrapiEntityTextSection,
  StrapiOrganization,
} from "@/types/generated/strapi";

interface EntityTextSectionProps extends StrapiEntityTextSection {
  entity: StrapiCause | StrapiOrganization | StrapiBlogPost;
}

export default function EntityTextSection({
  field,
  entity,
}: EntityTextSectionProps) {
  const text = field ? stringField(entity, field) : null;
  return <TextSection text={text} />;
}
