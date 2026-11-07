import "@/app/globals.css";
// Both styles: with only the italic faces, upright text would get them too.
// The family these declare is "Inter Variable", which --font-sans names.
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/inter/opsz-italic.css";
import type { Locale } from "@/utils/locale";
import { isPreview } from "@/utils/cms";
import { getStrapiURL } from "@/utils/strapi";
import PlausiblePageviews from "./PlausiblePageviews";
import PreviewBanner from "./PreviewBanner";

/** The document shell both languages' root layouts share. */
export default async function RootHtml({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const preview = await isPreview();
  // An editor's preview isn't a visit
  const plausibleDomain = preview ? undefined : process.env.PLAUSIBLE_DOMAIN;
  const umamiWebsiteId = preview ? undefined : process.env.UMAMI_WEBSITE_ID;

  return (
    <html lang={locale} className="h-full">
      {(plausibleDomain || umamiWebsiteId) && (
        // The App Router's own <head>: next/head belongs to the Pages Router.
        // oxlint-disable-next-line next/no-head-element
        <head>
          {plausibleDomain && (
            // A pinned copy of Plausible's manual script: it counts only what
            // it's given (PlausiblePageviews, utils/analytics.ts), with the
            // address the site gives it, which leaves out the query string.
            // Its events go through the /api/event proxy in next.config.mjs.
            <script
              defer
              src="/js/plausible-manual-37.js"
              data-domain={plausibleDomain}
              data-api="/api/event"
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
      <body className="flex min-h-full flex-col">
        {plausibleDomain && <PlausiblePageviews />}
        {children}
        {preview && <PreviewBanner locale={locale} />}
      </body>
    </html>
  );
}
