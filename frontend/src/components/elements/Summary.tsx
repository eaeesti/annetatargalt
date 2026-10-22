import { formatAmountWithCents, withCurrency } from "@/utils/money";
import type { Locale } from "@/utils/locale";
import Anchor from "./Anchor";

interface SummaryRow {
  title: string | null;
  href?: string | null;
  amount: number;
}

interface SummaryProps {
  summary: SummaryRow[];
  currency: string | null;
  totalText: string | null;
  totalAmount: number;
  locale: Locale;
}

export default function Summary({
  summary,
  currency,
  totalText,
  totalAmount,
  locale,
}: SummaryProps) {
  const money = (amount: number) =>
    withCurrency(formatAmountWithCents(amount, locale), currency, locale);

  return (
    <dl className="w-full divide-y divide-slate-200 text-sm">
      {summary.map((row, index) => (
        <div
          key={row.href ?? row.title ?? String(index)}
          className="flex items-center justify-between gap-3 py-2"
        >
          <dt>
            {row.href ? (
              <Anchor
                href={row.href}
                newTab={true}
                noIcon={true}
                className="text-slate-600 hover:opacity-70"
              >
                {row.title}
              </Anchor>
            ) : (
              <span className="text-slate-600">{row.title}</span>
            )}
          </dt>
          <dd className="font-medium whitespace-nowrap text-slate-900">
            {money(row.amount)}
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 py-2">
        <dt className="font-medium text-slate-900">{totalText}</dt>
        <dd className="font-medium whitespace-nowrap text-primary-700">
          {money(totalAmount)}
        </dd>
      </div>
    </dl>
  );
}
