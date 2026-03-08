import TextSection from "./TextSection";
import type { StrapiEntityTextSection } from "@/types/generated/strapi";

interface EntityTextSectionProps extends StrapiEntityTextSection {
  entity: Record<string, unknown>;
}

export default function EntityTextSection({ field, entity }: EntityTextSectionProps) {
  const text = field ? (entity[field] as string) : null;
  return <TextSection text={text} />;
}
