import type { NextConfig } from "next";

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
  // - script-src 'self' 'unsafe-inline' 'unsafe-eval': Next.js requires these
  // - style-src 'self' 'unsafe-inline': Tailwind inline styles require this
  // - img-src 'self' data: blob: https:: allow images from same origin, data URIs, and HTTPS
  // - connect-src 'self': API calls only to same origin
  // - frame-ancestors 'none': stronger clickjacking protection
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
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
