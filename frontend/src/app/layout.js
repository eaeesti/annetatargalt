import { Inter } from "next/font/google";
import "./globals.css";
import { getGlobal } from "../utils/strapi";
import { buildMetadata } from "../utils/seo";
import { classes } from "@/utils/react";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata() {
  const global = await getGlobal();

  return buildMetadata(global.metadata, {});
}

export default async function RootLayout({ children }) {
  return (
    <html lang="et" className="h-full">
      <body className={classes("flex min-h-full flex-col", inter.className)}>
        {children}
      </body>
    </html>
  );
}
