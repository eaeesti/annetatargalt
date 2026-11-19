import { useId } from "react";

interface DonationOverviewProps {
  title: string | null;
  /** "Monthly" or "One time", whichever the donor chose. */
  typeText: string | null;
  /** The donation line by line: DonationLines. */
  lines: React.ReactNode;
  /** Under the lines: the way back to change the donation, on Details. */
  edit?: React.ReactNode;
  totalText: string | null;
  total: string;
  /** After the total: Next on the first step, paying on Details. */
  children?: React.ReactNode;
}

/**
 * The donation as the donor builds it, beside the form: its lines, the
 * total, and what comes next.
 */
export default function DonationOverview({
  title,
  typeText,
  lines,
  edit,
  totalText,
  total,
  children,
}: DonationOverviewProps) {
  const titleId = useId();

  return (
    <aside aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2
          id={titleId}
          className="text-lg font-bold tracking-tight text-primary-700"
        >
          {title}
        </h2>
        {typeText && (
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-primary-700">
            {typeText}
          </span>
        )}
      </div>

      {lines}
      {edit}

      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-slate-900">{totalText}</span>
        <span className="text-2xl font-bold tracking-tight whitespace-nowrap text-primary-700">
          {total}
        </span>
      </div>

      {children}
    </aside>
  );
}
