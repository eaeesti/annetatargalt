import ReactMarkdown from "react-markdown";

export default function TextSection({ text }) {
  return (
    <section className="flex justify-center px-4 py-24">
      <ReactMarkdown className="w-full max-w-2xl prose" children={text} />
    </section>
  );
}
