export function buildMetadata(global, pageMetadata) {
  const globalMetadata = global.metadata;
  let title = globalMetadata.title;
  if (pageMetadata.title) title = `${pageMetadata.title} • ${title}`;

  const icons = {};
  if (global.favicon16 && global.favicon32) {
    icons.icon = [
      {
        url: global.favicon16?.data?.attributes.url,
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: global.favicon32?.data?.attributes.url,
        sizes: "32x32",
        type: "image/png",
      },
    ];
  }
  if (global.appleTouchIcon) {
    icons.apple = [
      {
        url: global.appleTouchIcon?.data?.attributes.url,
        sizes: "180x180",
        type: "image/png",
      },
    ];
  }

  const ogImage =
    pageMetadata.shareImage?.data?.attributes ||
    globalMetadata.shareImage?.data?.attributes;

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
