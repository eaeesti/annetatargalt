import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
