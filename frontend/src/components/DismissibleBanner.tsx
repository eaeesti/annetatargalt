"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";

const BANNER_DISMISSED_KEY = "topBannerDismissed";

interface DismissibleBannerProps {
  closeText: string | null;
  children: React.ReactNode;
}

/** The banner's frame and close button; Banner renders what it says. */
export default function DismissibleBanner({
  closeText,
  children,
}: DismissibleBannerProps) {
  // Use lazy initializer to read localStorage on mount without useEffect
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(BANNER_DISMISSED_KEY) === "true";
  });

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="flex items-center gap-6 bg-primary-600 p-3 pl-6">
      <div className="min-w-0 flex-1 text-sm text-white">{children}</div>
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
