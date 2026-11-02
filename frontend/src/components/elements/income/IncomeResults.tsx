import Button from "../Button";
import HighlightedText from "../HighlightedText";
import Markdown from "../Markdown";
import CostComparison from "./CostComparison";
import InfoDialog from "./InfoDialog";
import { countText } from "./IncomeForm";
import MedianMultiple from "./MedianMultiple";
import RecommendedOrganizations from "./RecommendedOrganizations";
import ShareButtons from "./ShareButtons";
import WorldIncomeChart from "./WorldIncomeChart";
import {
  compareIncome,
  equivalisedIncome,
  formatNumber,
  type Household,
} from "@/utils/income";
import type { Locale } from "@/utils/locale";
import { withCurrency } from "@/utils/money";
import { format } from "@/utils/string";
import { uiText } from "@/utils/ui-text";
import type { StrapiIncomeCalculatorSection } from "@/types/generated/strapi";

/** From how many times the world's median it's worth asking if that feels rich. */
const RICH_MULTIPLE = 6;

function percent(value: number, locale: Locale) {
  return `${formatNumber(value, locale, 1)}%`;
}

interface IncomeResultsProps {
  household: Household;
  section: StrapiIncomeCalculatorSection;
  donateLink: string | null;
  locale: Locale;
}

/** Where a household's income places it in the world, and what it can do. */
export default function IncomeResults({
  household,
  section,
  donateLink,
  locale,
}: IncomeResultsProps) {
  const comparison = compareIncome(equivalisedIncome(household));
  const times = Math.floor(comparison.timesMedian);
  const closeText = uiText(locale).close;
  const people = [
    countText(household.adults, section.adultText, section.adultsText),
    household.children > 0 &&
      countText(household.children, section.childText, section.childrenText),
  ]
    .filter(Boolean)
    .join(", ");
  const values = {
    income: withCurrency(formatNumber(household.income, locale), "€", locale),
    household: people,
    top: percent(comparison.top, locale),
    percentile: percent(comparison.percentile, locale),
  };

  // Below the world's median, the data is too sparse to place an income
  // reliably, so it isn't placed at all.
  if (comparison.timesMedian < 1) {
    return (
      <section className="flex animate-fade-in flex-col items-center gap-3 px-4 py-16 text-center sm:py-24">
        <h2 className="max-w-xl text-xl font-semibold text-balance text-primary-700 sm:text-2xl">
          {section.lowIncomeTitle}
        </h2>
        <p className="max-w-xl text-pretty text-slate-600 sm:text-lg">
          {format(section.lowIncomeText ?? "", values)}
        </p>
      </section>
    );
  }

  return (
    <div className="flex animate-fade-in flex-col">
      <section className="flex flex-col items-center gap-6 px-4 pt-16 text-center sm:pt-24">
        <p className="max-w-2xl text-pretty text-slate-500 sm:text-lg [&_strong]:font-semibold [&_strong]:text-slate-600">
          <HighlightedText text={format(section.summaryText ?? "", values)} />
        </p>
        <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-balance text-primary-700 xs:text-4xl sm:text-6xl">
          {format(section.richerThanText ?? "", values)}
        </h2>
        <InfoDialog
          linkText={section.costOfLivingText}
          title={section.methodologyTitle}
          text={section.methodology}
          closeText={closeText}
          className="text-primary-700"
        />
      </section>
      <div className="mt-16 mb-8 sm:mt-12">
        <WorldIncomeChart
          percentile={comparison.percentile}
          perPersonIncome={equivalisedIncome(household)}
          householdIncome={household.income}
          families={section.families}
          youText={section.youText}
          youCardTitle={section.youCardTitle}
          household={people}
          income={values.income}
          incomeLabel={section.incomeLabel}
          perDayText={section.familyPerDayText}
          perMonthText={section.familyPerMonthText}
          creditText={section.familyCreditText}
          caption={section.chartCaption}
          locale={locale}
        />
      </div>
      {times >= RICH_MULTIPLE && (
        <>
          <MedianMultiple
            times={times}
            section={section}
            locale={locale}
            closeText={closeText}
          />
          <section className="bg-slate-100 px-4 py-16 text-center sm:py-24">
            <h2 className="text-2xl font-bold tracking-tight text-balance text-primary-700 xs:text-3xl sm:text-4xl">
              {section.fairerTitle}
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg font-semibold text-balance text-slate-700 sm:text-xl">
              {section.fairerSubtitle}
            </p>
            <p className="mx-auto mt-1 max-w-xl text-balance text-slate-600 sm:text-lg">
              {section.fairerText}
            </p>
          </section>
        </>
      )}
      <CostComparison section={section} locale={locale} closeText={closeText} />
      <section className="flex flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
        <h2 className="text-2xl font-bold tracking-tight text-balance text-primary-700 xs:text-3xl sm:text-4xl">
          {section.effectiveGivingTitle}
        </h2>
        <Markdown className="prose max-w-xl text-balance prose-primary sm:prose-lg">
          {section.effectiveGivingText}
        </Markdown>
      </section>
      <RecommendedOrganizations
        section={section}
        donateLink={donateLink}
        locale={locale}
      />
      {/* On phones the buttons fill the width as an organization card's do,
          with as much room at the sides as its contents have. */}
      <section className="flex flex-col items-center gap-10 px-8 py-20 text-center xs:px-12 sm:px-4 sm:py-28">
        <h2 className="max-w-xl text-xl font-bold tracking-tight text-balance text-primary-700 xs:text-2xl md:text-3xl">
          {section.ctaText}
        </h2>
        {section.ctaButton && (
          <Button
            text={section.ctaButton.text}
            type={section.ctaButton.type}
            size={section.ctaButton.size}
            href={section.ctaButton.href}
            arrow={section.ctaButton.arrow}
            newTab={section.ctaButton.newTab}
            plausibleEvent={section.ctaButton.plausibleEvent}
            className="w-full max-w-3xl sm:w-auto"
          />
        )}
        {section.shareText && (
          <div className="mt-8 flex w-full max-w-3xl flex-col items-center gap-6">
            <h2 className="text-lg text-slate-700 sm:text-xl">
              {section.shareText}
            </h2>
            <ShareButtons
              message={section.shareMessage}
              facebookText={section.facebookShareText}
              twitterText={section.twitterShareText}
              blueskyText={section.blueskyShareText}
              linkedinText={section.linkedinShareText}
            />
          </div>
        )}
      </section>
    </div>
  );
}
