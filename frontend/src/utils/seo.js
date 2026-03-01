export function buildMetadata(global, pageMetadata) {
  const globalMetadata = global.metadata;

  if (!pageMetadata) return globalMetadata;

  let title = globalMetadata.title;
  if (pageMetadata.title) title = `${pageMetadata.title} • ${title}`;

  const icons = {};
  // In Strapi v5, media is returned flat (not nested under data.attributes)
  if (global.favicon16?.url && global.favicon32?.url) {
    icons.icon = [
      {
        url: global.favicon16.url,
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: global.favicon32.url,
        sizes: "32x32",
        type: "image/png",
      },
    ];
  }
  if (global.appleTouchIcon?.url) {
    icons.apple = [
      {
        url: global.appleTouchIcon.url,
        sizes: "180x180",
        type: "image/png",
      },
    ];
  }

  const ogImage =
    pageMetadata.shareImage ||
    globalMetadata.shareImage;

  const openGraph = {};
  if (ogImage) {
    openGraph.images = [
      {
        url: ogImage.url,
        width: ogImage.width,
        height: ogImage.height,
        alt: ogImage.alternativeText,
      },
    ];
  }

  const metadata = {
    title,
    description: pageMetadata.description || globalMetadata.description,
    openGraph,
    icons,
  };

  return metadata;
}
