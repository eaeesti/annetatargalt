import "@/app/globals.css";
import PlausibleProvider from "next-plausible";
// Both styles: with only the italic faces, upright text would get them too.
// The family these declare is "Inter Variable", which --font-sans names.
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/inter/opsz-italic.css";
import type { Locale } from "@/utils/locale";

/** The document shell both languages' root layouts share. */
export default function RootHtml({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const plausibleDomain = process.env.PLAUSIBLE_DOMAIN;

  return (
    <html lang={locale} className="h-full">
      {plausibleDomain && (
        // The App Router's own <head>: next/head belongs to the Pages Router.
        // oxlint-disable-next-line next/no-head-element
        <head>
          <PlausibleProvider
            domain={plausibleDomain}
            scriptProps={
              {
                src: "/js/script.js",
                "data-api": "/api/event",
              } as React.ComponentPropsWithoutRef<"script">
            }
          />
        </head>
      )}
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
