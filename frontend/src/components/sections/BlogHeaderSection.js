import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import Anchor from "../elements/Anchor";
import Image from "../elements/Image";

export default function SpecialHeaderSection({ entity, backButton, global }) {
  const author = entity.author.data.attributes;

  return (
    <header className="relative px-4">
      <Image
        data={entity.image}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_75%] saturate-50"
        priority
      />
      <div className="absolute inset-0 -z-10 h-full bg-primary-950/70"></div>
      <div className="mx-auto max-w-3xl py-24 md:py-56">
        <div className="flex flex-col gap-8 text-white">
          <Anchor
            className="flex items-center gap-1 self-start rounded-full bg-primary-100/10 px-2.5 py-1.5 text-sm text-white hover:bg-primary-100/20"
            href={backButton.href}
          >
            <ArrowLeftIcon className="h-5 w-5 text-primary-100" />
            {backButton.text}
          </Anchor>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
            {entity.title}
          </h1>
          <div className="flex flex-col gap-2 text-base text-slate-300 md:flex-row md:text-lg">
            <address className="not-italic">
              {author.name}, {author.role}
            </address>
            <span className="pointer-events-none hidden select-none md:block">
              •
            </span>
            <time dateTime={entity.date}>
              {new Date(entity.date).toLocaleDateString(global.dateLocale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        </div>
      </div>
    </header>
  );
}
