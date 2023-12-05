import { Inter } from "next/font/google";
import "./globals.css";
import { getGlobal } from "../utils/strapi";
import { buildMetadata } from "../utils/seo";
import { classes } from "@/utils/react";
import PlausibleProvider from "next-plausible";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata() {
  const global = await getGlobal();

  return buildMetadata(global, {});
}

export default async function RootLayout({ children }) {
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
            }}
          />
        </head>
      )}
      <body className={classes("flex min-h-full flex-col", inter.className)}>
        {children}
      </body>
    </html>
  );
}
