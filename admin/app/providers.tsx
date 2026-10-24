"use client";

import { ThemeProvider } from "next-themes";

/** `nonce` lets the theme's inline script run under the CSP. */
export function Providers({
  nonce,
  children,
}: {
  nonce: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      nonce={nonce}
    >
      {children}
    </ThemeProvider>
  );
}
