"use client";

import dynamic from "next/dynamic";
import LoadingSection from "./sections/LoadingSection";

// The sections (and the map) that run in the browser, each in a bundle of its
// own, so a page loads the code of the ones it shows and no others. Imported
// directly by Section, they would all share one bundle that every page loads:
// the landing page would download the donation form. next/dynamic only splits
// them like this when it's called in a client component, which is why this
// file is one. They're still rendered on the server.

export const CampaignSection = dynamic(
  () => import("./sections/CampaignSection"),
);
export const ContactSection = dynamic(
  () => import("./sections/ContactSection"),
);
export const DonationSection = dynamic(
  () => import("./sections/DonationSection"),
);
export const FAQSection = dynamic(() => import("./sections/FaqSection"));
export const ForeignDonationSection = dynamic(
  () => import("./sections/ForeignDonationSection"),
);
export const RedirectSection = dynamic(
  () => import("./sections/RedirectSection"),
);
export const StatsSection = dynamic(() => import("./sections/StatsSection"));
// The section reads the payment's token from the link, which a cached page
// doesn't have, so the cached page shows the loading state instead: the one the
// section shows while it fetches the donation. Passing `loading` is what puts
// the Suspense boundary around it that this needs.
export const ThankYouSection = dynamic(
  () => import("./sections/ThankYouSection"),
  { loading: () => <LoadingSection /> },
);
export const Map = dynamic(() => import("./elements/Map"));
