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

export default function ThankYouSection({ title, text1, text2, text3 }) {
  const router = useRouter();

  const searchParams = useSearchParams();
  const paymentToken = searchParams.get("payment_token");

  if (!paymentToken) {
    router.push("/");
    return <LoadingSection />;
  }

  const decodeURL = getStrapiURL(
    "/api/decode?" + new URLSearchParams({ payment_token: paymentToken }),
  );

  const { data, error, isLoading } = useSWR(decodeURL, fetcher);

  if (isLoading) return <LoadingSection />;

  // TODO: Make error section
  if (error) return <p>Error</p>;

  const donation = {
    ...data.donation,
    amount: formatEstonianAmount(data.donation.amount / 100),
  };

  // Remove payment_token from URL
  window.history.replaceState({}, document.title, window.location.pathname);

  return (
    <section className="flex h-full flex-grow bg-slate-100 px-4 py-24 sm:py-32 lg:px-8">
      <div className="container xl:max-w-5xl">
        <div className="mx-auto flex flex-col gap-8 lg:mx-0">
          <>
            <h1 className="text-4xl font-bold tracking-tight text-primary-700 sm:text-5xl">
              {format(title, donation)}
            </h1>
            <Markdown className="prose-md prose prose-primary w-full max-w-3xl">
              {format(text1, donation)}
            </Markdown>
            <Markdown className="prose-md prose prose-primary w-full max-w-3xl">
              {format(text2, donation)}
            </Markdown>
            <Markdown className="prose-md prose prose-primary w-full max-w-3xl">
              {format(text3, donation)}
            </Markdown>
          </>
        </div>
      </div>
    </section>
  );
}
