import { getGlobal } from "@/utils/strapi";

export default async function manifest() {
  const global = await getGlobal();
  console.log("global", global);

  const icons = [];

  if (global.chromeIcon192) {
    icons.push({
      src: global.chromeIcon192.data.attributes.url,
      sizes: "192x192",
      type: "image/png",
    });
  }

  if (global.chromeIcon512) {
    icons.push({
      src: global.chromeIcon512.data.attributes.url,
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
