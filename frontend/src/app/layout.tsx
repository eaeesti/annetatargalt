import "./globals.css";
import { getGlobal } from "../utils/strapi";
import { buildMetadata } from "../utils/seo";
import PlausibleProvider from "next-plausible";
import "@fontsource-variable/inter/opsz-italic.css";

export async function generateMetadata() {
  const global = await getGlobal();

  return buildMetadata(global, {});
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.PLAUSIBLE_DOMAIN;

  return (
    <html lang="et" className="h-full">
      {plausibleDomain && (
        <head>
          <PlausibleProvider
            domain={plausibleDomain}
            scriptProps={{
              src: "/js/script.js",
              "data-api": "/api/event",
            } as React.ComponentPropsWithoutRef<"script">}
          />
        </head>
      )}
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
