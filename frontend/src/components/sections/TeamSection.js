import { EnvelopeIcon } from "@heroicons/react/24/solid";
import Image from "../elements/Image";
import Markdown from "../elements/Markdown";
import Button from "../elements/Button";
import { SocialMediaIcon } from "../elements/SocialMediaIcon";
import CopyButton from "../elements/CopyButton";

export default function TeamSection({
  title,
  emailCopiedText,
  teamMembers,
  global,
}) {
  return (
    <section className="bg-slate-50 px-4 py-12 pt-24 lg:px-8">
      <div className="container flex flex-col gap-12 lg:max-w-3xl">
        <h2 className="inline-block max-w-full break-words text-2xl font-semibold tracking-tight text-primary-700 xs:text-2xl xs:font-bold sm:text-3xl">
          {title}
        </h2>
        <ul role="list" className="flex flex-col gap-12">
          {teamMembers.map((teamMember) => (
            <li
              key={teamMember.name}
              className="flex flex-col gap-8 sm:flex-row sm:gap-10"
            >
              {teamMember.image?.data?.attributes && (
                <Image
                  className="aspect-[4/5] w-52 flex-none rounded-2xl object-cover"
                  data={teamMember.image}
                />
              )}
              <div className="max-w-xl flex-auto">
                <h3 className="text-lg font-semibold leading-8 tracking-tight text-slate-900">
                  {teamMember.name}
                </h3>
                {teamMember.role && (
                  <p className="text-base leading-7 text-slate-600">
                    {teamMember.role}
                  </p>
                )}
                {teamMember.bio && (
                  <Markdown className="prose prose-primary mt-6 w-full">
                    {teamMember.bio}
                  </Markdown>
                )}
                {teamMember.email || teamMember.socialMediaLinks.length ? (
                  <div className="mt-6 flex gap-2">
                    {teamMember.email && (
                      <CopyButton
                        textToCopy={teamMember.email}
                        copiedText={emailCopiedText}
                        closeText={global.closeText}
                        size="link"
                        type="text"
                        className="text-slate-400"
                        noIcon={true}
                      >
                        <EnvelopeIcon className="h-6 w-6" />
                      </CopyButton>
                    )}
                    {teamMember.socialMediaLinks.map((socialMediaLink) => (
                      <Button
                        key={socialMediaLink.id}
                        id={socialMediaLink.id}
                        href={socialMediaLink.href}
                        newTab={true}
                        size="link"
                        type="text"
                        className="text-slate-400"
                        noIcon={true}
                      >
                        <SocialMediaIcon type={socialMediaLink.type} />
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
