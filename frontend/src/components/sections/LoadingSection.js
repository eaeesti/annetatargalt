import Spinner from "../elements/Spinner";

export default function LoadingSection() {
  return (
    <section className="flex h-full flex-grow items-center justify-center bg-slate-100 px-4 py-24 sm:py-32 lg:px-8">
      <Spinner className="h-20 w-20 text-primary-700" />
    </section>
  );
}
