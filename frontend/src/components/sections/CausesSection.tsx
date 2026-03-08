import Markdown from "../elements/Markdown";
import TextWithImageSection from "./TextWithImageSection";
import type { StrapiCausesSection, StrapiPage } from "@/types/generated/strapi";

interface CausesSectionProps extends StrapiCausesSection {
  page: StrapiPage;
}

export default function CausesSection({
  page: { slug },
  title,
  description,
  causes,
  anchor,
  readAboutOrganizationsText,
}: CausesSectionProps) {
  return (
    <>
      <section
        id={anchor!}
        className="flex flex-col items-center gap-6 px-4 pb-12 pt-24 lg:pt-36"
      >
        <div className="w-full max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
            {title}
          </h2>
        </div>
        <Markdown className="prose prose-primary w-full max-w-3xl">
          {description}
        </Markdown>
      </section>
      {causes.map((cause, i) => (
        <TextWithImageSection
          key={cause.id}
          title={cause.title}
          image={cause.image}
          text={cause.introduction}
          textOnRight={i % 2 === 1}
          buttons={[
            {
              id: 0,
              text: readAboutOrganizationsText,
              href: `/${cause.slug}`,
              type: "text",
              size: "sm",
              arrow: true,
              newTab: null,
              plausibleEvent: null,
            },
          ]}
        />
      ))}
    </>
  );
}
