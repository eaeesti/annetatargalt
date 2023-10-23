import Markdown from "../elements/Markdown";
import TextWithImageSection from "./TextWithImageSection";

export default function CausesSection({
  page: { slug },
  title,
  description,
  causes,
  donateText,
  readAboutOrganizationsText,
}) {
  console.log(causes);
  return (
    <>
      <section className="flex flex-col items-center gap-6 px-4 pb-12 pt-12 lg:pt-24">
        <div className="w-full max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
            {title}
          </h2>
        </div>
        <Markdown className="prose prose-primary w-full max-w-3xl">
          {description}
        </Markdown>
      </section>
      {causes.data.map(({ attributes: cause }, i) => (
        <TextWithImageSection
          key={cause.id}
          title={cause.title}
          image={cause.image}
          text={cause.introduction}
          textOnRight={i % 2 === 1}
          buttons={[
            {
              text: readAboutOrganizationsText,
              href: `/${slug}/${cause.slug}`,
              type: "text",
              size: "link",
              arrow: true,
              className: "text-primary-700 !font-medium",
            },
          ]}
        />
      ))}
    </>
  );
}
