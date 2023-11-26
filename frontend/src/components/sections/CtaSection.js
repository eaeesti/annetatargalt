import Button from "../elements/Button";
import Markdown from "../elements/Markdown";

export default function CtaSection({ title, description, buttons }) {
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
              <Button key={button.id} {...button} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
