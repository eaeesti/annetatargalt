import type { Metadata } from "next";
import type { StrapiGlobal, StrapiMetadata } from "@/types/generated/strapi";

export function buildMetadata(
  global: StrapiGlobal,
  pageMetadata: Partial<StrapiMetadata> | null | undefined,
): Metadata {
  const globalMetadata = global.metadata;

  if (!pageMetadata) return globalMetadata as Metadata;

  let title = globalMetadata?.title ?? null;
  if (pageMetadata.title) title = `${pageMetadata.title} • ${title}`;

  const icons: Metadata["icons"] = {};
  if (global.favicon16?.url && global.favicon32?.url) {
    icons.icon = [
      { url: global.favicon16.url, sizes: "16x16", type: "image/png" },
      { url: global.favicon32.url, sizes: "32x32", type: "image/png" },
    ];
  }
  if (global.appleTouchIcon?.url) {
    icons.apple = [
      { url: global.appleTouchIcon.url, sizes: "180x180", type: "image/png" },
    ];
  }

  const ogImage = pageMetadata.shareImage ?? globalMetadata?.shareImage;

  const openGraph: Metadata["openGraph"] = {};
  if (ogImage) {
    openGraph.images = [
      {
        url: ogImage.url,
        width: ogImage.width ?? undefined,
        height: ogImage.height ?? undefined,
        alt: ogImage.alternativeText ?? undefined,
      },
    ];
  }

  return {
    title,
    description: pageMetadata.description ?? globalMetadata?.description ?? null,
    openGraph,
    icons,
  };
}
