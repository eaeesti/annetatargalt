export default function robots() {
  const host_url = process.env.NEXT_PUBLIC_SITE_URL;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${host_url}/sitemap.xml`,
  };
}
