import ReactMarkdown from "react-markdown";

export default function TextSection({ data }) {
  return (
    <section className="flex justify-center px-4 py-8">
      <ReactMarkdown className="w-full max-w-2xl prose" children={data.text} />
    </section>
  );
}
