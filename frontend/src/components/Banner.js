"use client";

import { useState, useEffect } from "react";
import Markdown from "./elements/Markdown";
import { XMarkIcon } from "@heroicons/react/20/solid";

const BANNER_DISMISSED_KEY = "topBannerDismissed";

export default function Banner({ topBannerText, closeText }) {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    setIsDismissed(dismissed === "true");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  if (!topBannerText || isDismissed) {
    return null;
  }

  return (
    <div className="flex items-center gap-6 bg-primary-600 p-3 pl-6">
      <div className="min-w-0 flex-1 text-sm text-white">
        <Markdown className="prose-invert [&>p]:m-0 [&_a:hover]:text-slate-200 [&_a]:font-semibold [&_a]:underline [&_a]:decoration-from-font">
          {topBannerText}
        </Markdown>
      </div>
      <button
        type="button"
        className="rounded-lg p-2 hover:bg-primary-700 focus-visible:outline-offset-4"
        onClick={handleDismiss}
      >
        <span className="sr-only">{closeText}</span>
        <XMarkIcon className="h-5 w-5 text-white" />
      </button>
    </div>
  );
}
