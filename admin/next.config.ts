import type { NextConfig } from "next";

// Dev needs two things production must never have. React's development build
// calls eval() to reconstruct callstacks, and the bundler emits eval-wrapped
// modules for source maps, so script-src needs 'unsafe-eval'; HMR talks over a
// websocket, which not every browser treats as covered by 'self'. Both are
// added only here, so the policy served to the live admin panel is unaffected
// and a local `next build && next start` still exercises the real one.
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  // Only serve in a frame from the same origin (clickjacking protection)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No referrer info to external sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features not needed by the admin panel
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Content Security Policy
  // - default-src 'self': only load resources from same origin
  // - script-src 'self' 'unsafe-inline': Next streams its RSC payload through
  //   inline <script> blocks, so 'unsafe-inline' has to stay
  // - style-src 'self' 'unsafe-inline': Tailwind inline styles require this
  // - img-src 'self' data: blob: https:: allow images from same origin, data URIs, and HTTPS
  // - connect-src 'self': the browser never calls Strapi directly; every
  //   request goes through this app's own route handlers, which forward the
  //   session cookie. So same-origin is the complete list, and it is what
  //   stops an injected script shipping donor data anywhere.
  // - frame-ancestors 'none': stronger clickjacking protection
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      `connect-src 'self'${isDev ? " ws:" : ""}`,
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
