import Anchor from "../elements/Anchor";
import Button from "../elements/Button";
import Image from "../elements/Image";
import Markdown from "../elements/Markdown";

function Organization({
  organization,
  donateButtonText,
  donateLink,
  readMoreText,
  organizationLink,
}) {
  return (
    <div className="mx-auto mt-16 flex w-full max-w-2xl flex-col items-start gap-4 bg-slate-100 px-8 pb-8 xs:rounded-2xl">
      <Image
        data={organization.logo}
        className="-mt-16 mb-4 h-32 w-32 rounded-2xl shadow-lg"
      />
      <Anchor href={organizationLink}>
        <h3 className="text-xl font-semibold text-primary-700">
          {organization.title}
        </h3>
      </Anchor>
      <Markdown className="prose prose-primary w-full flex-grow">
        {organization.introduction}
      </Markdown>
      <div className="mt-4 flex w-full flex-col flex-wrap items-stretch gap-4 xs:flex-row xs:items-center">
        <Button
          text={donateButtonText}
          href={donateLink}
          type="primary"
          size="md"
        />
        <Button
          text={readMoreText}
          href={organizationLink}
          type="text"
          size="sm"
          className="text-slate-700"
          arrow
        />
      </div>
    </div>
  );
}

export default function SpecialOrganizationsSection({
  recommendedFundTitle,
  recommendedOrganizationsTitle,
  donateButtonText,
  readMoreText,
  entity,
  global,
}) {
  const organizationsWithFund = entity.organizations.data;

  const organizations = organizationsWithFund.filter(
    ({ attributes }) => !attributes.fund,
  );

  const fund = organizationsWithFund.find(({ attributes }) => attributes.fund);

  return (
    <section className="bg-slate-200 py-24">
      <div className="container flex flex-col items-center gap-24">
        <h2 className="inline-block max-w-full break-words px-4 text-center text-2xl font-semibold tracking-tight text-primary-700 xs:text-2xl xs:font-bold sm:text-3xl">
          {recommendedFundTitle}
        </h2>
        <div className="w-full xs:px-4">
          <Organization
            organization={fund.attributes}
            donateButtonText={donateButtonText}
            donateLink={global.donateLink}
            readMoreText={readMoreText}
            organizationLink={`/${entity.slug}/${fund.attributes.slug}`}
          />
        </div>
        <h2 className="mt-12 inline-block max-w-full break-words px-4 text-center text-2xl font-semibold tracking-tight text-primary-700 xs:text-2xl xs:font-bold sm:text-3xl">
          {recommendedOrganizationsTitle}
        </h2>
        <div className="grid grid-cols-1 justify-center gap-8 xs:px-4 lg:grid-cols-2 xl:grid-cols-3">
          {organizations.map(({ attributes: organization }) => (
            <Organization
              key={organization.id}
              organization={organization}
              donateButtonText={donateButtonText}
              donateLink={global.donateLink}
              readMoreText={readMoreText}
              organizationLink={`/${entity.slug}/${organization.slug}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
