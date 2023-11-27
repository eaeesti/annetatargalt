import Button from "../elements/Button";
import Image from "../elements/Image";
import Markdown from "../elements/Markdown";

export default function PowerSection({ title, column1, column2, bottomText }) {
  return (
    <section class="bg-slate-100 py-16 sm:py-32">
      <div class="container flex w-full max-w-full flex-col items-center gap-16 px-4 sm:w-auto sm:gap-32 md:px-8 xl:max-w-6xl">
        <h2 class="max-w-sm text-center text-2xl font-bold tracking-tight text-primary-700 [text-wrap:balance] sm:max-w-xl sm:text-4xl lg:max-w-none">
          {title}
        </h2>
        <div className="grid justify-center gap-24 lg:grid-cols-2">
          {[column1, column2].map((column) => (
            <div key={column.id} className="flex max-w-xl flex-col gap-8">
              <h3 className="text-md mb-4 text-center tracking-tight text-slate-600 sm:text-xl">
                <div>{column.title.split("**")[0]}</div>
                <strong className="mt-1 block text-xl font-semibold text-primary-700 sm:text-2xl">
                  {column.title.split("**")[1]}
                </strong>
              </h3>
              <div className="overflow-hidden rounded-3xl bg-white shadow-lg">
                <Image data={column.image} className="h-full w-full" />
              </div>
              <Markdown className="prose prose-primary">
                {column.description}
              </Markdown>
              <div className="flex justify-start text-primary-700">
                <Button {...column.button} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-center text-base text-slate-600 sm:text-xl">
          <div>{bottomText.split("**")[0]}</div>
          <strong className="text-md font-bold">
            {bottomText.split("**")[1]}
          </strong>
        </div>
      </div>
    </section>
  );
}
