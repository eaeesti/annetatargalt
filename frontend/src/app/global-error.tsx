"use client";

import "./globals.css";
import ErrorScreen from "@/components/ErrorScreen";

// Catches errors thrown in the root layout / generateMetadata (e.g. getGlobal()
// failing because Strapi rejected the API token). Must render its own <html>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="et">
      <body>
        <ErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
