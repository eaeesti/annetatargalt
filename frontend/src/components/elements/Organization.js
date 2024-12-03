import Anchor from "../elements/Anchor";
import Button from "../elements/Button";
import Image from "../elements/Image";
import Markdown from "../elements/Markdown";

export default function Organization({
  id,
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
          href={`${donateLink}?org=${id}`}
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
