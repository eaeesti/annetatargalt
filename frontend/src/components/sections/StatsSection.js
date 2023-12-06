"use client";

import { formatEstonianAmount } from "@/utils/estonia";
import { fetcher } from "@/utils/react";
import useSWR from "swr";
import LoadingSection from "./LoadingSection";
import { getStrapiURL } from "@/utils/strapi";

function Stat({ term, value, unit }) {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-end gap-y-4">
      <dt className="text-md leading-7 text-slate-600 [text-wrap:balance]">
        {term}
      </dt>
      <dd className="text-3xl font-semibold tracking-tight text-primary-700 sm:text-4xl">
        {unit ? `${value} ${unit}` : value}
      </dd>
    </div>
  );
}

export default function StatsSection({
  title,
  operatingSinceText,
  operatingSinceValue,
  donationAmountText,
  donationAmountCurrency,
  transactionFeeText,
  transactionFeeValue,
}) {
  const { data, error, isLoading } = useSWR(
    getStrapiURL("/api/stats"),
    fetcher,
  );

  if (isLoading) return <LoadingSection />;

  if (error) return;

  const { donationSum } = data;

  const donationAmount = Math.floor(donationSum / 100);

  return (
    <section className="bg-slate-50 py-24 sm:py-48">
      <h2 className="sr-only">{title}</h2>
      <div className="mx-auto max-w-7xl px-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-24 text-center lg:grid-cols-3">
          <Stat term={operatingSinceText} value={operatingSinceValue} />
          <Stat
            term={donationAmountText}
            value={formatEstonianAmount(donationAmount)}
            unit={donationAmountCurrency}
          />
          <Stat term={transactionFeeText} value={transactionFeeValue} />
        </dl>
      </div>
    </section>
  );
}
