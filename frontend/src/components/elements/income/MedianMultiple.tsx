import { useEffect, useRef, useState } from "react";
import Markdown from "../Markdown";
import InfoDialog from "./InfoDialog";
import { euroIncome, formatNumber, WORLD_MEDIAN_INCOME } from "@/utils/income";
import type { Locale } from "@/utils/locale";
import { withCurrency } from "@/utils/money";
import { classes } from "@/utils/react";
import { format } from "@/utils/string";
import type { StrapiIncomeCalculatorSection } from "@/types/generated/strapi";

interface MedianMultipleProps {
  /** How many times the world's median the income is, rounded down. */
  times: number;
  section: StrapiIncomeCalculatorSection;
  locale: Locale;
  closeText: string;
}

const COINS_PER_STACK = 10;
/** More coins than this would only fill the page; the number says the rest. */
const MAX_COINS = 100;

/**
 * A short cylinder: its top an ellipse, and its side a band below it with the
 * same curve at the bottom. A coin on top of it covers its top, so that only
 * the sides of the coins under the top one show.
 */
function Coin() {
  return (
    <span className="relative -mt-4 block h-[1.5625rem] w-14 last:mt-0">
      <span className="absolute inset-x-0 top-2 bottom-0 rounded-b-[50%_0.5rem] bg-amber-500 shadow-[inset_0_-1px_0_var(--color-amber-600)]" />
      <span className="absolute inset-x-0 top-0 h-4 rounded-[50%] bg-amber-300" />
    </span>
  );
}

interface CoinStacksProps {
  count: number;
}

/**
 * Coins in stacks of ten, side by side, the last stack the shortest. Where
 * there's room for only one stack a row, they make one tall stack instead.
 */
function CoinStacks({ count }: CoinStacksProps) {
  const stacks = Array.from(
    { length: Math.ceil(count / COINS_PER_STACK) },
    (_, index) => Math.min(count - index * COINS_PER_STACK, COINS_PER_STACK),
  );
  const ref = useRef<HTMLDivElement>(null);
  const [oneTall, setOneTall] = useState(false);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    // Every stack on a row of its own: none shares its bottom with another.
    // Merging them changes no widths, so it doesn't change the rows either.
    const update = () => {
      const bottoms = new Set(
        Array.from(container.children, (stack) =>
          Math.round(stack.getBoundingClientRect().bottom),
        ),
      );
      setOneTall(stacks.length > 1 && bottoms.size === stacks.length);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [stacks.length]);

  // In rows that wrap upwards, the start of a row is its bottom. One tall
  // stack's rows overlap as its coins do, its top sticking out as far.
  return (
    <div
      ref={ref}
      className={classes(
        "flex max-w-72 flex-wrap-reverse items-start justify-center gap-x-2",
        oneTall ? "pt-4" : "gap-y-3",
      )}
      aria-hidden
    >
      {stacks.map((coins, stack) => (
        // The first coin is the bottom one, and each covers the one below.
        <div
          key={stack}
          className={classes("flex flex-col-reverse", oneTall && "-mt-4")}
        >
          {Array.from({ length: coins }).map((_, coin) => (
            <Coin key={coin} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * How many times the world's median the visitor earns, said and shown: a coin
 * for each median income.
 */
export default function MedianMultiple({
  times,
  section,
  locale,
  closeText,
}: MedianMultipleProps) {
  const median = withCurrency(
    formatNumber(euroIncome(WORLD_MEDIAN_INCOME), locale),
    "€",
    locale,
  );

  return (
    <section className="bg-linear-to-b from-white via-slate-50 to-white py-20 sm:py-28">
      <div className="container flex flex-col gap-16 px-4 md:grid md:grid-cols-2 md:items-center md:px-8">
        <div className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold tracking-tight text-balance text-primary-700 xs:text-3xl sm:text-4xl">
            {section.multipleTitle}
          </h2>
          <Markdown className="prose prose-primary sm:prose-lg">
            {format(section.multipleText ?? "", { times: String(times) })}
          </Markdown>
          <InfoDialog
            linkText={section.methodologyLinkText}
            title={section.methodologyTitle}
            text={section.methodology}
            closeText={closeText}
            className="self-start text-primary-700"
          />
        </div>
        <div className="grid grid-cols-[auto_auto] justify-center gap-x-10 gap-y-4 sm:gap-x-16">
          <div className="flex flex-col items-center justify-end gap-4">
            <span className="text-4xl font-bold text-primary-700 sm:text-5xl">
              {formatNumber(times, locale)}×
            </span>
            <CoinStacks count={Math.min(times, MAX_COINS)} />
          </div>
          <div className="flex flex-col items-center justify-end">
            <CoinStacks count={1} />
          </div>
          <span className="text-center font-semibold text-primary-700 sm:text-lg">
            {section.youText}
          </span>
          <span className="text-center text-sm text-slate-600">
            <span className="block font-semibold text-primary-700">
              {section.medianText}
            </span>
            {/* "€238 a month" and "(adjusted for …)" on lines of their own */}
            {format(section.medianAmountText ?? "", { amount: median })
              .split(/ (?=\()/)
              .map((line) => (
                <span key={line} className="block whitespace-nowrap">
                  {line}
                </span>
              ))}
          </span>
        </div>
      </div>
    </section>
  );
}
