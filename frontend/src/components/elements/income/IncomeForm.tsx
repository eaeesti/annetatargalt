import { useState } from "react";
import { MinusIcon, PlusIcon } from "@heroicons/react/20/solid";
import Button from "../Button";
import {
  MAX_ADULTS,
  MAX_CHILDREN,
  parseIncome,
  type Household,
} from "@/utils/income";
import type { Locale } from "@/utils/locale";
import { format } from "@/utils/string";
import { uiText } from "@/utils/ui-text";
import type { StrapiIncomeCalculatorSection } from "@/types/generated/strapi";

/** "1 adult" or "2 adults", in the CMS's words. */
export function countText(
  count: number,
  one: string | null,
  many: string | null,
): string {
  return format((count === 1 ? one : many) ?? "", { count: String(count) });
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  setValue: (value: number) => void;
  text: string;
  decreaseLabel: string;
  increaseLabel: string;
}

/** A count between − and + buttons, in a box like the form's other fields. */
function Stepper({
  value,
  min,
  max,
  setValue,
  text,
  decreaseLabel,
  increaseLabel,
}: StepperProps) {
  const buttonClasses =
    "flex h-full w-12 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500";
  return (
    <div className="flex h-13 items-center rounded-md bg-white p-px ring-1 ring-slate-300 ring-inset">
      <button
        type="button"
        className={buttonClasses}
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => setValue(value - 1)}
      >
        <MinusIcon className="h-5 w-5" aria-hidden />
      </button>
      <span
        className="grow text-center text-lg text-slate-900"
        aria-live="polite"
      >
        {text}
      </span>
      <button
        type="button"
        className={buttonClasses}
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => setValue(value + 1)}
      >
        <PlusIcon className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

interface IncomeFormProps {
  section: StrapiIncomeCalculatorSection;
  locale: Locale;
  initial: Household | null;
  onSubmit: (household: Household) => void;
}

/** A household's monthly net income and the people living on it. */
export default function IncomeForm({
  section,
  locale,
  initial,
  onSubmit,
}: IncomeFormProps) {
  const [incomeText, setIncomeText] = useState(
    initial
      ? String(initial.income).replace(".", locale === "et" ? "," : ".")
      : "",
  );
  const [adults, setAdults] = useState(initial?.adults ?? 1);
  const [children, setChildren] = useState(initial?.children ?? 0);
  const income = parseIncome(incomeText);
  const labels = uiText(locale);

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-6 sm:max-w-lg"
      onSubmit={(event) => {
        event.preventDefault();
        if (income) onSubmit({ income, adults, children });
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-900">
          {section.householdLabel}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Stepper
            value={adults}
            min={1}
            max={MAX_ADULTS}
            setValue={setAdults}
            text={countText(adults, section.adultText, section.adultsText)}
            decreaseLabel={labels.fewerAdults}
            increaseLabel={labels.moreAdults}
          />
          <Stepper
            value={children}
            min={0}
            max={MAX_CHILDREN}
            setValue={setChildren}
            text={countText(children, section.childText, section.childrenText)}
            decreaseLabel={labels.fewerChildren}
            increaseLabel={labels.moreChildren}
          />
        </div>
      </fieldset>
      <div>
        <label
          htmlFor="income"
          className="mb-2 block text-sm font-semibold text-slate-900"
        >
          {section.incomeLabel}
        </label>
        <div className="relative">
          <input
            id="income"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="block w-full rounded-md border-0 py-3 pr-10 pl-4 text-xl text-slate-900 ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-3 focus:ring-primary-600 focus:ring-inset"
            value={incomeText}
            onChange={(event) => setIncomeText(event.target.value)}
          />
          <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xl text-slate-400 select-none">
            €
          </div>
        </div>
      </div>
      <Button
        buttonType="submit"
        type="primary"
        size="lg"
        className="w-full"
        text={section.calculateButtonText}
        disabled={!income}
        plausibleEvent="income-calculated"
      />
      <p className="text-center text-sm text-slate-500">
        {section.privacyNote}
      </p>
    </form>
  );
}
