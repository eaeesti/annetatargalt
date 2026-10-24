import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-sans",
  // latin-ext has letters like š, ž and õ in donor names
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Anneta Targalt Admin",
    // e.g. "Donation #1843 · Anneta Targalt Admin"
    template: "%s · Anneta Targalt Admin",
  },
  description: "Donation admin panel",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This response's CSP nonce, from proxy.ts. Reading it renders every page
  // per request, which a nonce needs; the admin's pages are anyway.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
