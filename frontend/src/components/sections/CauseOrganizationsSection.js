import Button from "../elements/Button";
import Image from "../elements/Image";

export default function SpecialOrganizationsSection({
  title,
  donateButtonText,
  readMoreText,
  entity,
  global,
}) {
  const organizationsWithFund = entity.organizations.data;

  const organizations = organizationsWithFund.filter(
    ({ attributes }) => !attributes.fund,
  );

  return (
    <section className="bg-slate-200 px-4 py-24">
      <div className="container flex flex-col items-center gap-16">
        <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
          {title}
        </h2>
        <div className="grid grid-cols-1 justify-center gap-8 lg:grid-cols-2 xl:grid-cols-3">
          {organizations.map(({ attributes: organization }) => (
            <div
              key={organization.id}
              className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl bg-slate-100 p-8"
            >
              <Image
                data={organization.logo}
                className="mb-4 max-w-[8rem] rounded-2xl"
              />
              <h3 className="w-full text-xl font-semibold text-primary-700">
                {organization.title}
              </h3>
              <div className="w-full flex-grow text-slate-600">
                {organization.introduction}
              </div>
              <div className="mt-4 flex w-full flex-col flex-wrap items-stretch gap-4 xs:flex-row xs:items-center">
                <Button
                  text={donateButtonText}
                  href={global.donateLink}
                  type="primary"
                  size="md"
                />
                <Button
                  text={readMoreText}
                  href={`/${entity.slug}/${organization.slug}`}
                  type="text"
                  size="sm"
                  className="text-slate-700"
                  arrow
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
