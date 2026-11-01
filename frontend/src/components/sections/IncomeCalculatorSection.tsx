"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import IncomeForm from "../elements/income/IncomeForm";
import IncomeResults from "../elements/income/IncomeResults";
import Markdown from "../elements/Markdown";
import {
  householdFromQuery,
  householdQuery,
  type Household,
} from "@/utils/income";
import { localeOf } from "@/utils/locale";
import type {
  StrapiGlobal,
  StrapiIncomeCalculatorSection,
} from "@/types/generated/strapi";

type IncomeCalculatorSectionProps = StrapiIncomeCalculatorSection & {
  global: StrapiGlobal;
};

/**
 * How rich a household's monthly net income in Estonia is compared with the
 * world. Nothing typed in leaves the browser, but the results' link has the
 * household in its query (?income=1500&adults=1&children=0), so it can be
 * shared. Pages are served from a cache, which can't have a visitor's query:
 * the cached page has the empty form, the fallback here, and the browser
 * replaces it with the results.
 */
export default function IncomeCalculatorSection(
  props: IncomeCalculatorSectionProps,
) {
  return (
    <Suspense fallback={<Calculator {...props} initial={null} />}>
      <CalculatorForLink {...props} />
    </Suspense>
  );
}

function CalculatorForLink(props: IncomeCalculatorSectionProps) {
  const initial = householdFromQuery(useSearchParams());
  return (
    <Calculator
      key={initial ? householdQuery(initial) : ""}
      {...props}
      initial={initial}
    />
  );
}

interface CalculatorProps extends IncomeCalculatorSectionProps {
  initial: Household | null;
}

function Calculator({ global, initial, ...section }: CalculatorProps) {
  const locale = localeOf(global);
  const [household, setHousehold] = useState(initial);
  // Each calculation shows the results afresh, so they animate in again, and
  // brings them into view.
  const [calculations, setCalculations] = useState(initial ? 1 : 0);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (calculations > 0) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [calculations]);

  return (
    <section className="text-slate-600">
      <div className="flex justify-center px-4 py-16 sm:py-20">
        <IncomeForm
          section={section}
          locale={locale}
          initial={initial}
          onSubmit={(submitted) => {
            setHousehold(submitted);
            setCalculations((count) => count + 1);
            window.history.replaceState(
              null,
              "",
              `?${householdQuery(submitted)}`,
            );
          }}
        />
      </div>
      {household && (
        <div
          ref={resultsRef}
          className="scroll-mt-16 border-t border-slate-200"
        >
          <IncomeResults
            key={calculations}
            household={household}
            section={section}
            donateLink={global.donateLink}
            locale={locale}
          />
        </div>
      )}
      {section.sourcesText && (
        <div className="border-t border-slate-200 px-4 py-10">
          <Markdown className="mx-auto prose prose-sm max-w-xl text-center text-slate-500 prose-primary">
            {section.sourcesText}
          </Markdown>
        </div>
      )}
    </section>
  );
}
