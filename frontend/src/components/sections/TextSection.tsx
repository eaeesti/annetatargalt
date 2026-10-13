import Markdown from "../elements/Markdown";

interface TextSectionProps {
  text: string | null;
}

export default function TextSection({ text }: TextSectionProps) {
  if (!text) return null;

  return (
    <section className="flex justify-center px-4 py-24">
      <Markdown className="prose w-full max-w-3xl prose-primary">
        {text}
      </Markdown>
    </section>
  );
}
