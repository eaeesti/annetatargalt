"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/utils/locale";

const TEXT = {
  et: { notice: "Eelvaade: näed ka avaldamata muudatusi.", exit: "Lõpeta" },
  en: { notice: "Preview: you also see unpublished changes.", exit: "End" },
} satisfies Record<Locale, Record<string, string>>;

/** Tells an editor the page shows drafts, and lets them leave the preview. */
export default function PreviewBanner({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const text = TEXT[locale];

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
      <span>{text.notice}</span>
      {/* A plain link: the route sets the cookie, which a client-side
          navigation wouldn't wait for. */}
      <a
        href={`/api/preview?${new URLSearchParams({ status: "published", path: pathname })}`}
        className="font-semibold underline"
      >
        {text.exit}
      </a>
    </div>
  );
}
