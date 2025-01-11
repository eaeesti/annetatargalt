import { useState } from "react";
import { equivalizeIncome } from "./utils/calculator";
import { preventingDefault } from "./utils/utils";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import { GCEvent } from "next-goatcounter";

export default function IncomeInput({ submitIncome }) {
  const [income, setIncome] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [changingHousehold, setChangingHousehold] = useState(false);

  function submit() {
    GCEvent("calculate");
    const equivalizedIncome = equivalizeIncome(income, adults, children);
    submitIncome(equivalizedIncome);
  }

  const amountRegex = new RegExp(/^(\d+)?([.,]\d{1,2})?$/);
  const valid =
    amountRegex.test(income) && income > 0 && adults >= 1 && children >= 0;

  return (
    <form
      onSubmit={preventingDefault(submit)}
      className="w-full max-w-xs space-y-4 md:max-w-md"
    >
      <div>
        <label htmlFor="incomeInput" className="mb-1 block text-sm">
          {changingHousehold
            ? "Leibkonna igakuine netosissetulek:"
            : "Igakuine netosissetulek:"}
        </label>
        <div className="relative text-xl">
          <input
            id="incomeInput"
            type="text"
            inputMode="numeric"
            className="block w-full rounded-md border-0 py-4 pl-5 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus-within:outline-none focus:ring-[3px] focus:ring-inset focus:ring-primary-600"
            value={income}
            onInput={(event) => setIncome(event.target.value)}
          />
          <div className="pointer-events-none absolute right-4 top-0 flex h-full select-none items-center justify-center text-slate-400">
            €
          </div>
        </div>
      </div>
      {changingHousehold ? (
        <div className="flex flex-col space-y-4">
          <div className="flex flex-row space-x-4">
            <div className="flex w-full flex-col">
              <label htmlFor="adultsInput" className="mb-1 block text-sm">
                Täiskasvanuid:
              </label>
              <input
                id="adultsInput"
                type="number"
                className="block w-full rounded-md border-0 px-5 py-4 text-xl text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus-within:outline-none focus:ring-[3px] focus:ring-inset focus:ring-primary-600"
                min={1}
                max={10}
                value={adults}
                onInput={(event) => setAdults(event.target.value)}
              />
            </div>
            <div className="flex w-full flex-col">
              <label htmlFor="childrenInput" className="mb-1 block text-sm">
                Lapsi:
              </label>
              <input
                id="childrenInput"
                type="number"
                className="block w-full rounded-md border-0 px-5 py-4 text-xl text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus-within:outline-none focus:ring-[3px] focus:ring-inset focus:ring-primary-600"
                min={0}
                max={100}
                value={children}
                onInput={(event) => setChildren(event.target.value)}
              />
            </div>
          </div>
          <div className="text-sm">
            Kasutame{" "}
            <a
              href="https://en.wikipedia.org/wiki/Equivalisation"
              className="font-semibold text-primary-700 hover:opacity-70"
              target="_blank"
              rel="noopener noreferrer"
            >
              OECD ekvivaliseerimist
              <ArrowTopRightOnSquareIcon className="mb-1 ml-1 inline h-4 w-4" />
            </a>
            .
          </div>
        </div>
      ) : (
        <div className="flex flex-row space-x-1 text-sm">
          <div>Leibkonnakoosseis: 1 täiskasvanu</div>
          <button
            type="button"
            className="opacity cursor-pointer font-bold text-primary-700 hover:opacity-70"
            onClick={() => setChangingHousehold(true)}
          >
            Muuda
          </button>
        </div>
      )}
      <div>
        <button
          type="submit"
          className="mt-4 block w-full items-center justify-center gap-1.5 rounded-md bg-primary-700 px-4 py-3 text-center font-semibold tracking-tight text-white shadow-sm hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-600"
          disabled={!valid}
        >
          Arvuta!
        </button>
      </div>
      <p className="text-center text-sm">
        Me ei salvesta sinu sisestatud andmeid.
      </p>
    </form>
  );
}
