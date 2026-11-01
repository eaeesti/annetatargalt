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

// Draft mode's cookie is the whole site's, so an editor who previewed in
// Strapi would see drafts on every page they opened afterwards. Outside
// Strapi's frame this ends the preview and loads the published page, before
// anything is drawn.
const LEAVE_PREVIEW_OUTSIDE_STRAPI = `if (window.top === window.self) location.replace("/api/preview?" + new URLSearchParams({ status: "published", path: location.pathname + location.search }));`;

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
      {(plausibleDomain || umamiWebsiteId || preview) && (
        // The App Router's own <head>: next/head belongs to the Pages Router.
        // oxlint-disable-next-line next/no-head-element
        <head>
          {preview && (
            // oxlint-disable-next-line react/no-danger
            <script
              dangerouslySetInnerHTML={{ __html: LEAVE_PREVIEW_OUTSIDE_STRAPI }}
            />
          )}
          {plausibleDomain && (
            // A pinned copy of Plausible's manual script: it counts only what
            // it's given (PlausiblePageviews, utils/analytics.ts), with the
            // address the site gives it, which leaves out the query string.
            // Its events go to our own Plausible, on the backend's domain.
            <script
              defer
              src="/js/plausible-manual-37.js"
              data-domain={plausibleDomain}
              data-api={getStrapiURL("/p/api/event")}
            />
          )}
          {umamiWebsiteId && (
            <>
              {/* Umami, beside Plausible: Umami for events and their
                  properties, Plausible for the overview. Its tracker is a pinned
                  copy served from here, so the analytics server can't change
                  what runs on the site, and it sends to the backend's domain,
                  which the content security policy already allows. The hook
                  before it leaves query strings and fragments out of what's
                  sent; the tracker is told to leave fragments out too, as the
                  settings page has a donor's token in it. */}
              <script defer src="/js/umami-before-send.js" />
              <script
                defer
                src="/js/umami-3.4.1.js"
                data-website-id={umamiWebsiteId}
                data-host-url={getStrapiURL("/u")}
                data-before-send="umamiBeforeSend"
                data-exclude-hash="true"
              />
            </>
          )}
        </head>
      )}
      <body className="flex min-h-full flex-col bg-white">
        {plausibleDomain && <PlausiblePageviews />}
        {children}
        {preview && <PreviewBanner locale={locale} />}
      </body>
    </html>
  );
}
