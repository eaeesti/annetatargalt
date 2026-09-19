import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The public site renders CMS markdown written by Strapi editors on every
// page, the donation form included. rehype-sanitize in Markdown.tsx is what
// stops a script being injected there; this policy is the second layer, and
// its job is to limit what injected script could *achieve* if the first layer
// were ever bypassed.
//
// Note the honest limitation: Next streams its RSC payload through inline
// <script> blocks, so 'unsafe-inline' has to stay in script-src. Removing it
// would mean issuing a nonce per request, which forces every page to render
// dynamically and gives up static generation on a content site. So this does
// NOT stop an injected inline script from running. What it does do is take
// away the places such a script could send anything: connect-src and img-src
// deny every host except this org's own, form-action stops a rewritten form
// posting elsewhere, and frame-ancestors blocks framing the donation page.
// Exfiltration, not execution, is what this buys.
//
// Every entry below was derived from what the live pages actually load.
//
// The Strapi origin is read from the same variable the browser code uses
// rather than hard-coded, so that local dev (127.0.0.1:1337) and any preview
// environment get a policy that matches where they actually call. Hard-coding
// production here would silently break every client-side fetch in dev, and
// CSP failures surface only in the browser console — exactly the kind of
// breakage nobody notices until a donor hits it.
const strapiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_STRAPI_API_URL ?? "").origin;
  } catch {
    return "https://strapi.annetatargalt.ee";
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Cloudinary serves CMS images; placehold.co is configured in images below.
  "img-src 'self' data: blob: https://res.cloudinary.com https://placehold.co",
  "media-src 'self' https://res.cloudinary.com",
  "font-src 'self' data:",
  // Client components call Strapi directly (donate, donateForeign, contact,
  // stats, decode). Plausible needs no entry: the rewrites below proxy
  // /js/script.js and /api/event, so it is same-origin from the browser.
  `connect-src 'self' ${strapiOrigin}`,
  // The cause pages embed charts, and iframe is the one tag added to the
  // sanitiser's allowlist. The sanitiser cannot police where an iframe points,
  // so this is what confines it to the chart host.
  "frame-src https://ourworldindata.org",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Redundant next to frame-ancestors, kept for browsers that honour only this.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  // This app sits next to a repo-root yarn.lock as well as its own. Turbopack,
  // which builds by default from Next 16, walks up to the outermost lockfile
  // and would take the repo root as the project root — which resolves every
  // page relative to the wrong directory and fails the build outright. Say
  // which directory is actually the root.
  turbopack: {
    root: __dirname,
  },

  // Enable React Compiler for automatic memoization
  reactCompiler: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: "/js/script.js",
        destination: "https://plausible.io/js/script.js",
      },
      {
        source: "/api/event",
        destination: "https://plausible.io/api/event",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/heategevused",
        destination: "/kuhu-annetada",
        permanent: false,
      },
      {
        source: "/meetod",
        destination: "/kuhu-annetada",
        permanent: false,
      },
      {
        source: "/tulumaks",
        destination: "/kkk",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
