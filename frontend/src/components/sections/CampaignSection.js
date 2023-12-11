"use client";

import { format } from "@/utils/string";
import Markdown from "../elements/Markdown";
import { formatEstonianAmount } from "@/utils/estonia";
import useSWR from "swr";
import { fetcher } from "@/utils/react";
import { getStrapiURL } from "@/utils/strapi";
import { useEffect, useRef, useState } from "react";

// https://stackoverflow.com/a/67826055/12123296
function useOnScreen(ref) {
  const [isOnScreen, setIsOnScreen] = useState(false);
  const observerRef = useRef(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(([entry]) =>
      setIsOnScreen(entry.isIntersecting),
    );
  }, []);

  useEffect(() => {
    observerRef.current.observe(ref.current);

    return () => {
      observerRef.current.disconnect();
    };
  }, [ref]);

  return isOnScreen;
}

export default function CampaignSection({
  title,
  topText,
  bottomText,
  goals,
  decoration,
}) {
  const [progress, setProgress] = useState(0);

  const progressBarRef = useRef(null);
  const progressBarOnScreen = useOnScreen(progressBarRef);

  const { data, error, isLoading } = useSWR(
    getStrapiURL("/api/stats"),
    fetcher,
  );

  useEffect(() => {
    if (progress === percentage) return;
    if (!progressBarOnScreen) return;

    if (percentage - progress < 0.1) {
      setProgress(percentage);
      return;
    }

    setTimeout(() => {
      setProgress(progress + (percentage - progress) * 0.1);
    }, 16);
  }, [progress, data, progressBarOnScreen]);

  let amount;
  if (isLoading) {
    amount = 0;
  } else {
    amount = data.campaignSum / 100;
  }

  if (error) return;

  const goal = goals.find((goal) => amount < goal) || goals.at(-1);
  const percentage = (amount / goal) * 100;

  const amountProgress = (progress / 100) * goal;

  const numbers = {
    amount: formatEstonianAmount(Math.floor(amountProgress)),
    goal: formatEstonianAmount(goal),
    remainingUntilGoal: formatEstonianAmount(Math.ceil(goal - amountProgress)),
  };

  return (
    <div className="bg-white text-slate-600">
      <div
        className="h-16 w-full bg-top bg-repeat-x xs:h-20 sm:h-24 md:h-32"
        style={{
          backgroundImage: `url(${decoration.data?.attributes.url})`,
          backgroundSize: "auto 100%",
        }}
      />
      <div
        id="progress"
        className="mx-auto flex max-w-6xl flex-col space-y-12 px-4 pb-32 pt-16 text-center sm:pt-32"
      >
        <h2 className="mb-8 text-2xl font-bold text-primary-700 md:text-4xl">
          {title}
        </h2>
        {topText && (
          <Markdown className="prose prose-lg max-w-full text-slate-600 [&_strong]:whitespace-nowrap [&_strong]:text-2xl [&_strong]:text-primary-700">
            {format(topText, numbers)}
          </Markdown>
        )}
        <div
          ref={progressBarRef}
          className="w-full overflow-hidden rounded-lg bg-slate-200"
        >
          {percentage ? (
            <div
              className="overflow-hidden bg-primary-700 text-sm text-white lg:text-base"
              style={{ width: `${progress}%` }}
            >
              {progress.toFixed(1)}%
            </div>
          ) : (
            <>&nbsp;</>
          )}
        </div>
        {bottomText && (
          <div className="prose-md prose max-w-full text-slate-600 [&_strong]:text-2xl [&_strong]:text-primary-700">
            <Markdown>{bottomText}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
