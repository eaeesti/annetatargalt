import Image from "../elements/Image";
import Markdown from "../elements/Markdown";

export default function PartnerSection({ text, image }) {
  return (
    <section className="bg-slate-100 px-4 py-12 md:px-8">
      <div className="mx-auto flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:gap-10 sm:text-left lg:max-w-2xl">
        <div class="shrink-0 rounded-full bg-white p-4 shadow-md shadow-slate-200">
          <Image data={image} className="h-32 w-32" />
        </div>
        <Markdown className="prose prose-primary">{text}</Markdown>
      </div>
    </section>
  );
}
