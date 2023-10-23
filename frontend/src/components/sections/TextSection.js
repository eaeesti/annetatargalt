import Markdown from "../elements/Markdown";

export default function TextSection({ text }) {
  return (
    <section className="flex justify-center px-4 py-24">
      <Markdown className="w-full max-w-3xl prose prose-primary">
        {text}
      </Markdown>
    </section>
  );
}
