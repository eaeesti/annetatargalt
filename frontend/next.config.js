/** @type {import('next').NextConfig} */

const nextConfig = {
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

module.exports = nextConfig;
