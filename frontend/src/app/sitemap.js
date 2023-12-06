import { getAllSlugs } from "@/utils/strapi";

export default async function Sitemap() {
  const host_url = process.env.NEXT_PUBLIC_SITE_URL;

  const allSlugs = await getAllSlugs();

  const index = {
    url: host_url,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 1,
  };

  const others = allSlugs
    .filter((slug) => slug !== "/")
    .map((slug) => ({
      url: `${host_url}/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    }));

  return [index, ...others];
}
