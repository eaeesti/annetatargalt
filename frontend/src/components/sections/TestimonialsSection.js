import Image from "../elements/Image";
import Markdown from "../elements/Markdown";

export default function TestimonialsSection({ title, testimonials }) {
  return (
    <section className="bg-white px-0 py-12 sm:px-4 sm:py-20 md:px-8">
      <div className="mx-auto flex flex-col gap-12 lg:max-w-5xl">
        <h2 className="inline-block max-w-full break-words text-center text-2xl font-semibold tracking-tight text-primary-700 xs:text-2xl xs:font-bold sm:text-3xl">
          {title}
        </h2>
        <div className="mx-auto flow-root">
          <div className="-mt-6 flex flex-col items-center md:block md:columns-2 md:gap-6">
            {testimonials.map((testimonial) => (
              <figure
                key={testimonial.id}
                className="mt-4 flex flex-col gap-6 bg-slate-50 p-6 text-sm leading-6 sm:mt-6 sm:inline-flex sm:rounded-2xl md:p-8"
              >
                <blockquote>
                  <Markdown className="prose prose-sm prose-primary w-full">
                    {testimonial.text}
                  </Markdown>
                </blockquote>
                <figcaption className="flex items-center gap-x-4">
                  <Image
                    className="h-10 w-10 rounded-full bg-slate-100"
                    data={testimonial.image}
                  />
                  <div>
                    <div className="font-semibold text-slate-900">
                      {testimonial.name}
                    </div>
                    <div className="text-slate-600">{testimonial.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
