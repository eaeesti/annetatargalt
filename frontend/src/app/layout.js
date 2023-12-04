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
  const plausible_domain = process.env.PLAUSIBLE_DOMAIN;

  return (
    <html lang="et" className="h-full">
      {plausible_domain && (
        <head>
          <PlausibleProvider domain={plausible_domain} />
        </head>
      )}
      <body className={classes("flex min-h-full flex-col", inter.className)}>
        {children}
      </body>
    </html>
  );
}
