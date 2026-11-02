import "@/app/globals.css";
import PlausibleProvider from "next-plausible";
// Both styles: with only the italic faces, upright text would get them too.
// The family these declare is "Inter Variable", which --font-sans names.
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/inter/opsz-italic.css";
import type { Locale } from "@/utils/locale";
import { getStrapiURL } from "@/utils/strapi";

// The script reads where to send events from data-api. React's types for a
// script's props have no data-* attributes, so this is a variable: written
// inline, the object would be rejected for having a property they don't know.
const plausibleScriptProps = {
  src: "/js/script.js",
  "data-api": "/api/event",
};

/** The document shell both languages' root layouts share. */
export default function RootHtml({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const plausibleDomain = process.env.PLAUSIBLE_DOMAIN;
  const umamiWebsiteId = process.env.UMAMI_WEBSITE_ID;

  return (
    <html lang={locale} className="h-full">
      {(plausibleDomain || umamiWebsiteId) && (
        // The App Router's own <head>: next/head belongs to the Pages Router.
        // oxlint-disable-next-line next/no-head-element
        <head>
          {plausibleDomain && (
            <PlausibleProvider
              domain={plausibleDomain}
              scriptProps={plausibleScriptProps}
            />
          )}
          {umamiWebsiteId && (
            <>
              {/* Umami, beside Plausible for now. Its tracker is a pinned
                  copy served from here, so the analytics server can't change
                  what runs on the site, and it sends to the backend's domain,
                  which the content security policy already allows. The hook
                  before it leaves query strings out of what's sent. */}
              <script defer src="/js/umami-before-send.js" />
              <script
                defer
                src="/js/umami-3.4.1.js"
                data-website-id={umamiWebsiteId}
                data-host-url={getStrapiURL("/u")}
                data-before-send="umamiBeforeSend"
              />
            </>
          )}
        </head>
      )}
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
