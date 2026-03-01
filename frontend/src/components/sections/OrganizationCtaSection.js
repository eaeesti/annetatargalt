import { format } from "@/utils/string";
import CtaSection from "./CtaSection";

export default function OrganizationCtaSection({
  title,
  description,
  donateText,
  entity,
  global,
}) {
  const buttonText = format(donateText, {
    title: entity.title,
  });

  return (
    <CtaSection
      title={title}
      description={description}
      buttons={[
        {
          text: buttonText,
          href: `${global.donateLink}?org=${entity.internalId}`,
          type: "white",
          size: "lg",
        },
      ]}
    />
  );
}
