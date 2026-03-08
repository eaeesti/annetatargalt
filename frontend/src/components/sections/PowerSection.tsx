import Button from "../elements/Button";
import Image from "../elements/Image";
import Markdown from "../elements/Markdown";
import type { StrapiPowerSection } from "@/types/generated/strapi";

export default function PowerSection({ title, column1, column2 }: StrapiPowerSection) {
  return (
    <section className="bg-slate-100 py-16 sm:py-32">
      <div className="container flex w-full max-w-full flex-col items-center gap-16 px-4 sm:w-auto sm:gap-32 md:px-8 xl:max-w-6xl">
        <h2 className="max-w-sm text-center text-2xl font-bold tracking-tight text-primary-700 [text-wrap:balance] sm:max-w-xl sm:text-4xl lg:max-w-none">
          {title}
        </h2>
        <div className="grid justify-center gap-24 lg:grid-cols-2">
          {[column1, column2].map((column) => {
            if (!column) return null;
            const [titleBefore, titleBold] = (column.title ?? "").split("**");
            return (
              <div key={column.id} className="flex max-w-xl flex-col gap-8">
                <h3 className="text-md mb-4 text-center tracking-tight text-slate-600 sm:text-xl">
                  <div>{titleBefore}</div>
                  <strong className="mt-1 block text-xl font-semibold text-primary-700 sm:text-2xl">
                    {titleBold}
                  </strong>
                </h3>
                <div className="overflow-hidden rounded-3xl bg-white shadow-lg">
                  <Image data={column.image} className="h-full w-full" />
                </div>
                <Markdown className="prose prose-sm prose-primary -mt-5 mb-3 max-w-full text-right text-xs [&>p>a>svg]:-mt-1">
                  {column.source}
                </Markdown>
                <Markdown className="prose prose-primary">
                  {column.description}
                </Markdown>
                {column.button && (
                  <div className="flex justify-start text-primary-700">
                    <Button
                      text={column.button.text}
                      type={column.button.type}
                      size={column.button.size}
                      href={column.button.href}
                      arrow={column.button.arrow}
                      newTab={column.button.newTab}
                      plausibleEvent={column.button.plausibleEvent}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
