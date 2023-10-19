import { Inter } from "next/font/google";
import "./globals.css";
import { getGlobal } from "../utils/strapi";
import { buildMetadata } from "../utils/seo";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata() {
  const global = await getGlobal();

  return buildMetadata(global.metadata, {});
}

export default async function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
