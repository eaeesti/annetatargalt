import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import Button from "@/components/elements/Button";
import Markdown from "@/components/elements/Markdown";
import { getGlobal } from "@/utils/strapi";

export default async function NotFound() {
  const global = await getGlobal();

  if (!global.notFoundPage) return;

  const { title, description, buttons } = global.notFoundPage;

  return (
    <>
      <Navbar global={global} />
      <main className="grid h-full flex-grow place-items-center bg-white px-6 py-24 sm:py-48 lg:px-8">
        <div className="text-center">
          <p className="text-base font-semibold text-primary-600 sm:text-2xl">
            404
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {title}
          </h1>
          <Markdown className="prose mt-6 max-w-2xl">{description}</Markdown>
          <div className="mt-10 flex flex-col justify-center gap-4 text-sm sm:flex-row sm:items-center">
            {buttons.map((button) => (
              <Button key={button.id} {...button} />
            ))}
          </div>
        </div>
      </main>
      <Footer global={global} />
    </>
  );
}
