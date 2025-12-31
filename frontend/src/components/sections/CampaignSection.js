"use client";

import { format } from "@/utils/string";
import Markdown from "../elements/Markdown";
import Button from "../elements/Button";
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
    if (ref.current && observerRef.current) {
      observerRef.current.observe(ref.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [ref]);

  return isOnScreen;
}

function Countdown({ endDate, countdownText }) {
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          ended: true,
        });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds, ended: false });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  if (!timeRemaining) {
    return null;
  }

  if (timeRemaining.ended) {
    return null;
  }

  const formattedText = format(countdownText, timeRemaining);

  return (
    <Markdown className="text-lg md:text-xl [&_strong]:font-bold [&_strong]:text-primary-700">
      {formattedText}
    </Markdown>
  );
}

export default function CampaignSection({
  title,
  topText,
  bottomText,
  goals,
  decoration,
  endDate,
  countdownText,
  ctaButtonHref,
  ctaButtonText,
}) {
  const [progress, setProgress] = useState(0);
  const progressBarRef = useRef(null);
  const progressBarOnScreen = useOnScreen(progressBarRef);

  const { data, error, isLoading } = useSWR(
    getStrapiURL("/api/stats"),
    fetcher,
  );

  // Hide entire section if campaign has ended
  if (endDate) {
    const now = new Date().getTime();
    const end = new Date(endDate).getTime();
    if (now > end) {
      return null;
    }
  }

  if (error) return;

  let amount;
  if (isLoading) {
    amount = 0;
  } else {
    amount = data.campaignSum / 100;
  }

  const goal = goals.find((goal) => amount < goal) || goals.at(-1);
  const percentage = (amount / goal) * 100;

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
  }, [progress, data, progressBarOnScreen, percentage]);

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
          <div class="flex justify-center">
            <div className="prose-md prose max-w-full rounded-2xl bg-slate-50 p-8 text-slate-600 lg:px-12 [&_strong]:text-2xl [&_strong]:text-primary-700">
              <Markdown>{bottomText}</Markdown>
            </div>
          </div>
        )}
        {endDate && countdownText && (
          <Countdown endDate={endDate} countdownText={countdownText} />
        )}
        {ctaButtonHref && ctaButtonText && (
          <div className="flex justify-center">
            <Button
              href={ctaButtonHref}
              text={ctaButtonText}
              type="primary"
              size="xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}
