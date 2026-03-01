import { getGlobal } from "@/utils/strapi";

export default async function manifest() {
  const global = await getGlobal();

  const icons = [];

  // In Strapi v5, media is returned flat (not nested under data.attributes)
  if (global.chromeIcon192) {
    icons.push({
      src: global.chromeIcon192.url,
      sizes: "192x192",
      type: "image/png",
    });
  }

  if (global.chromeIcon512) {
    icons.push({
      src: global.chromeIcon512.url,
      sizes: "512x512",
      type: "image/png",
    });
  }

  return {
    name: global.metadata.title,
    short_name: global.metadata.title,
    description: global.metadata.description,
    theme_color: "#047857", // primary 700 from tailwind.config.js
    background_color: "#ffffff",
    display: "standalone",
    start_url: "/",
    icons,
  };
}
