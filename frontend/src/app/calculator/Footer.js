import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";

export default function Footer() {
  return (
    <div className="flex w-full flex-col items-center space-y-2 text-center">
      <div>
        Ienākumu sadales avots:{" "}
        <a
          href="https://howrichami.givingwhatwecan.org/"
          className="whitespace-nowrap font-semibold text-primary-700 hover:opacity-70"
          target="_blank"
          rel="noopener noreferrer"
        >
          Giving What We Can
          <ArrowTopRightOnSquareIcon className="mb-1 ml-1 inline h-4 w-4" />
        </a>
      </div>
      <div>
        Ziedojumu ietekmes avots:{" "}
        <a
          href="https://www.givewell.org/impact-estimates"
          className="whitespace-nowrap font-semibold text-primary-700 hover:opacity-70"
          target="_blank"
          rel="noopener noreferrer"
        >
          GiveWell
          <ArrowTopRightOnSquareIcon className="mb-1 ml-1 inline h-4 w-4" />
        </a>
      </div>
      <div>
        <a
          href="https://github.com/ealatvia/ziedoefektivi"
          className="whitespace-nowrap font-semibold text-primary-700 hover:opacity-70"
          target="_blank"
          rel="noopener noreferrer"
        >
          Rīka pirmkods
          <ArrowTopRightOnSquareIcon className="mb-1 ml-1 inline h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
