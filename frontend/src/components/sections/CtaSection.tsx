import Button from "../elements/Button";
import Markdown from "../elements/Markdown";
import type { StrapiButton } from "@/types/generated/strapi";

interface CtaSectionProps {
  title: string | null;
  description: string | null;
  buttons: StrapiButton[];
}

export default function CtaSection({ title, description, buttons }: CtaSectionProps) {
  return (
    <div className="bg-primary-800 text-white">
      <div className="px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <Markdown className="prose w-full max-w-3xl text-primary-100">
            {description}
          </Markdown>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            {buttons.map((button) => (
              <Button
                key={button.id}
                text={button.text}
                type={button.type}
                size={button.size}
                href={button.href}
                arrow={button.arrow}
                newTab={button.newTab}
                plausibleEvent={button.plausibleEvent}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
