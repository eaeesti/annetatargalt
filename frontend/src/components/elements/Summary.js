import { formatEstonianAmountWithCents } from "@/utils/estonia";
import Anchor from "./Anchor";

export default function Summary({ summary, currency, totalText, totalAmount }) {
  return (
    <dl className="w-full divide-y divide-slate-200 text-sm">
      {summary.map((row, index) => (
        <div
          key={index}
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
          <dd className="whitespace-nowrap font-medium text-slate-900">
            {formatEstonianAmountWithCents(row.amount)}
            {currency}
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 py-2">
        <dt className="font-medium text-slate-900">{totalText}</dt>
        <dd className="whitespace-nowrap font-medium text-primary-700">
          {formatEstonianAmountWithCents(totalAmount)}
          {currency}
        </dd>
      </div>
    </dl>
  );
}
