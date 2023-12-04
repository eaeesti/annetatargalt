import Markdown from "../elements/Markdown";

export default function TextSection({ text }) {
  if (!text) return null;

  return (
    <section className="flex justify-center px-4 py-24">
      <Markdown className="prose prose-primary w-full max-w-3xl">
        {text}
      </Markdown>
    </section>
  );
}
