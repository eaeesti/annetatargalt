import { useState } from "react";
import { usePlausible } from "next-plausible";
import ChildrenIcon from "@/components/icons/ChildrenIcon";
import MedicineIcon from "@/components/icons/MedicineIcon";
import MosquitoNetIcon from "@/components/icons/MosquitoNetIcon";
import ToyIcon from "@/components/icons/ToyIcon";
import WaterIcon from "@/components/icons/WaterIcon";
import HighlightedText from "../HighlightedText";
import InfoDialog from "./InfoDialog";
import { formatNumber } from "@/utils/income";
import type { Locale } from "@/utils/locale";
import { withCurrency } from "@/utils/money";
import { classes } from "@/utils/react";
import { format } from "@/utils/string";
import type {
  StrapiCostExample,
  StrapiIncomeCalculatorSection,
} from "@/types/generated/strapi";

const ICONS = {
  toy: ToyIcon,
  water: WaterIcon,
  "mosquito-net": MosquitoNetIcon,
  medicine: MedicineIcon,
  children: ChildrenIcon,
};

const MIN_AMOUNT = 2;
const MAX_AMOUNT = 100;
/** Up to this many icons, three rows of five, five fit on a row. */
const FEW_ICONS = 15;
/** Above this many icons, four rows of eight, they're smaller, ten to a row. */
const MANY_ICONS = 32;

/** How many of the example's thing the donation pays for. */
function countOf(example: StrapiCostExample, donation: number) {
  return example.cost ? Math.floor(donation / example.cost) : 0;
}

/** "7 children a toy", for the question that has both examples in it. */
function choiceText(
  example: StrapiCostExample,
  donation: number,
  locale: Locale,
) {
  const count = countOf(example, donation);
  const template =
    count === 1 && example.oneChoiceText
      ? example.oneChoiceText
      : example.choiceText;
  return format(template ?? "", { count: formatNumber(count, locale) });
}

interface ExampleProps {
  example: StrapiCostExample;
  amount: string;
  donation: number;
  highlighted: boolean;
  closeText: string;
  locale: Locale;
}

function Example({
  example,
  amount,
  donation,
  highlighted,
  closeText,
  locale,
}: ExampleProps) {
  const count = countOf(example, donation);
  const template =
    count === 1 && example.oneText ? example.oneText : example.text;
  const Icon = example.icon ? ICONS[example.icon] : null;
  return (
    <div
      className={classes(
        "flex flex-col items-center gap-4 rounded-2xl px-6 py-10 text-center sm:px-10",
        highlighted
          ? "bg-white text-primary-800 sm:py-12"
          : "bg-primary-800 text-white [&_strong]:text-white",
      )}
    >
      <p className="text-lg font-semibold sm:text-xl">{example.label}</p>
      {Icon && (
        <div
          className={classes(
            "flex max-w-full flex-wrap justify-center",
            // Five to a row (5 × 1.5rem + 4 × 0.375rem), then eight, then ten
            // smaller ones in the same width as eight: 10 × 1.25rem +
            // 9 × 0.25rem, or 8 × 1.5rem + 7 × 0.375rem.
            count <= FEW_ICONS
              ? "w-36 gap-1.5"
              : count <= MANY_ICONS
                ? "w-[14.75rem] gap-1.5"
                : "w-[14.75rem] gap-1",
          )}
          aria-hidden
        >
          {Array.from({ length: Math.max(count, 1) }).map((_, index) => (
            <Icon
              key={index}
              className={classes(
                count > MANY_ICONS ? "h-5 w-5" : "h-6 w-6",
                count === 0 && "opacity-30",
                highlighted && "text-primary-600",
              )}
            />
          ))}
        </div>
      )}
      <p className="text-balance">
        <HighlightedText
          text={format(template ?? "", {
            amount,
            count: formatNumber(count, locale),
          })}
        />
      </p>
      <InfoDialog
        linkText={example.note}
        title={example.label}
        text={example.noteDetails}
        closeText={closeText}
        className="text-xs opacity-80"
      />
    </div>
  );
}

interface CostComparisonProps {
  section: StrapiIncomeCalculatorSection;
  locale: Locale;
  closeText: string;
}

/**
 * One amount, chosen on a slider, at a popular charity and at an effective
 * one, and what it buys at each.
 */
export default function CostComparison({
  section,
  locale,
  closeText,
}: CostComparisonProps) {
  const plausible = usePlausible();
  const { popularExample, effectiveExample } = section;
  const [donation, setDonation] = useState(() =>
    Math.min(
      Math.max(Math.ceil(popularExample?.cost ?? 15), MIN_AMOUNT),
      MAX_AMOUNT,
    ),
  );
  if (!popularExample || !effectiveExample) return null;

  // "€43", or just "43" for a question that names the currency in words
  const euros = formatNumber(donation, locale);
  const amount = withCurrency(euros, "€", locale);
  const progress = (100 * (donation - MIN_AMOUNT)) / (MAX_AMOUNT - MIN_AMOUNT);

  return (
    <section className="bg-primary-700 px-4 py-20 text-white sm:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-balance xs:text-3xl sm:text-4xl">
          {section.comparisonTitle}
        </h2>
        <p className="text-xl sm:text-2xl">
          {format(section.comparisonQuestion ?? "", { amount, euros })}
        </p>
        <div className="relative my-4 flex w-full max-w-xl items-center">
          <div className="absolute h-3 w-full rounded-full border-2 border-white" />
          <div
            className="absolute h-3 rounded-full bg-white"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            className="form-range-light z-0 w-full"
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            step={1}
            value={donation}
            aria-label={format(section.comparisonQuestion ?? "", {
              amount,
              euros,
            }).replaceAll("**", "")}
            onChange={(event) => setDonation(Number(event.target.value))}
            onMouseUp={() => plausible("income-comparison-changed")}
            onTouchEnd={() => plausible("income-comparison-changed")}
          />
        </div>
        <div className="relative isolate grid w-full items-center sm:grid-cols-2">
          <Example
            example={popularExample}
            amount={amount}
            donation={donation}
            highlighted={false}
            closeText={closeText}
            locale={locale}
          />
          {/* Between the boxes: on the line where they meet when they're
              stacked, and in the middle when they're side by side. */}
          {section.versusText && (
            <span className="relative z-10 -my-7 flex h-14 w-14 items-center justify-center justify-self-center rounded-full bg-primary-700 text-sm font-semibold ring-4 ring-white sm:absolute sm:top-1/2 sm:left-1/2 sm:my-0 sm:-translate-x-1/2 sm:-translate-y-1/2">
              {section.versusText}
            </span>
          )}
          <Example
            example={effectiveExample}
            amount={amount}
            donation={donation}
            highlighted={true}
            closeText={closeText}
            locale={locale}
          />
        </div>
        {section.choiceQuestion && countOf(popularExample, donation) > 0 && (
          <p className="mt-4 max-w-xl text-lg text-balance sm:text-xl [&_strong]:text-white">
            <HighlightedText
              text={format(section.choiceQuestion, {
                popular: choiceText(popularExample, donation, locale),
                effective: choiceText(effectiveExample, donation, locale),
              })}
            />
          </p>
        )}
      </div>
    </section>
  );
}
