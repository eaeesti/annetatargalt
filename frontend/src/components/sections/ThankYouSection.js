"use client";

import { fetcher } from "@/utils/react";
import Markdown from "../elements/Markdown";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { getStrapiURL } from "@/utils/strapi";
import { format } from "@/utils/string";
import { formatEstonianAmount } from "@/utils/estonia";
import { useRouter } from "next/navigation";
import LoadingSection from "./LoadingSection";
import DonationSummary from "../elements/DonationSummary";

export default function ThankYouSection({
  title,
  text1,
  text2,
  text3,
  global,
}) {
  const router = useRouter();

  const searchParams = useSearchParams();
  const orderToken = searchParams.get("order-token");

  const decodeURL = getStrapiURL(
    "/api/decode?" + new URLSearchParams({ "order-token": orderToken }),
  );

  const { data, error, isLoading } = useSWR(
    () => (orderToken ? decodeURL : null),
    fetcher,
  );

  if (isLoading) return <LoadingSection />;

  if (!data || !data.donation) {
    return router.push("/");
  }

  const donation = {
    ...data.donation.donor,
    amount: formatEstonianAmount(data.donation.amount / 100),
  };

  return (
    <section className="flex h-full flex-grow bg-white px-4 py-24 sm:py-32 lg:px-8">
      <div className="container xl:max-w-5xl">
        <div className="mx-auto flex flex-col items-center gap-12 lg:mx-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 122.88 116.87"
            className="mb-8 h-24 w-24 text-primary-700"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M 42.449219 0 L 31.880859 17.869141 L 11.730469 22.320312 L 13.679688 42.990234 L 0 58.429688 L 13.730469 74.009766 L 11.730469 94.550781 L 32 99.080078 L 42.449219 116.86914 L 61.509766 108.61914 L 80.429688 116.86914 L 91 99 L 111.15039 94.550781 L 109.19922 73.869141 L 122.88086 58.429688 L 109.15039 42.849609 L 111.15039 22.320312 L 90.880859 17.789062 L 80.429688 0 L 61.369141 8.2402344 L 42.449219 0 z M 79.873047 37.443359 C 85.152109 37.698359 89.680156 44.455469 84.910156 49.480469 L 61.669922 77.199219 A 7.13 7.13 0 0 1 51.769531 77.640625 C 47.829531 73.890625 42.049922 68.5 37.919922 65 C 31.849922 58.47 41.169922 48.740391 47.919922 54.900391 C 50.299922 57.070391 53.760156 60.240625 56.160156 62.390625 L 74.660156 39.660156 C 76.270156 37.995156 78.113359 37.358359 79.873047 37.443359 z "
            />
          </svg>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-primary-700 sm:text-5xl">
            {format(title, donation)}
          </h1>
          <Markdown className="prose-md prose prose-primary w-full max-w-3xl [&>p>strong]:text-primary-700">
            {format(text1, donation)}
          </Markdown>
          <div className="w-full max-w-3xl rounded-xl bg-slate-50 px-8 py-6">
            <DonationSummary
              donation={data.donation}
              currency={global.currency}
              totalText={global.totalText}
              tipOrganization={global.tipOrganization}
            />
          </div>
          <Markdown className="prose-md prose prose-primary w-full max-w-3xl">
            {format(text2, donation)}
          </Markdown>
          <Markdown className="prose-md prose prose-primary w-full max-w-3xl">
            {format(text3, donation)}
          </Markdown>
        </div>
      </div>
    </section>
  );
}
