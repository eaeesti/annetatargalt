import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import { GCEvent } from "next-goatcounter";

export default function CallToAction() {
  return (
    <div className="flex w-full flex-col items-center space-y-6 text-center md:space-y-12">
      <h2 className="text-xl [text-wrap:balance] md:text-2xl">
        Gudri ziedojot, Jūs varat ļoti pozitīvi ietekmēt palīdzību cilvēkiem.
      </h2>
      <a
        href="/"
        className="select-none rounded-md bg-primary-700 px-6 py-3 font-semibold tracking-tight text-white hover:bg-primary-600 sm:px-8 sm:py-4 sm:text-xl"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => GCEvent("cta-click")}
      >
        Vēlos uzzināt par gudru ziedošanu.
        <ArrowTopRightOnSquareIcon className="mb-0.5 ml-2 inline h-5 w-5" />
      </a>
    </div>
  );
}
