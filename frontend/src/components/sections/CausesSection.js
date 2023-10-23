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
      <section className="flex flex-col gap-6 items-center px-4 pt-24 pb-12">
        <div className="w-full max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
            {title}
          </h2>
        </div>
        <Markdown className="w-full max-w-3xl prose prose-primary">
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
