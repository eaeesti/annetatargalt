import type { Metadata } from "next";
import type { StrapiGlobal, StrapiMetadata } from "@/types/generated/strapi";
import { DEFAULT_LOCALE } from "./locale";
import { imageSource } from "./image";
import type { Locale } from "./locale";

interface Languages {
  locale: Locale;
  /** The page's path in each language that has it. */
  paths: Partial<Record<Locale, string>>;
  /** Whether this language's version is public yet. */
  launched: boolean;
}

/**
 * Canonical and hreflang links once a language is public. Before that an
 * English page is reachable for reviewers but asks not to be indexed, and
 * the Estonian pages don't point at it.
 */
function languageMetadata({ locale, paths, launched }: Languages): Metadata {
  if (!launched) {
    return locale === DEFAULT_LOCALE ? {} : { robots: { index: false } };
  }
  const languages: Record<string, string> = { ...paths };
  if (paths[DEFAULT_LOCALE]) languages["x-default"] = paths[DEFAULT_LOCALE];
  return {
    alternates: {
      canonical: paths[locale],
      ...(Object.keys(paths).length > 1 ? { languages } : {}),
    },
  };
}

export function buildMetadata(
  global: StrapiGlobal,
  pageMetadata: Partial<StrapiMetadata>,
  languages?: Languages,
): Metadata {
  const globalMetadata = global.metadata;

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

  const ogImage =
    imageSource(pageMetadata.shareImage) ??
    imageSource(globalMetadata?.shareImage);

  const openGraph: Metadata["openGraph"] = {};
  if (ogImage) {
    openGraph.images = [
      {
        url: ogImage.file.url,
        width: ogImage.file.width ?? undefined,
        height: ogImage.file.height ?? undefined,
        alt: ogImage.alt || undefined,
      },
    ];
  }

  return {
    title,
    description:
      pageMetadata.description ?? globalMetadata?.description ?? null,
    openGraph,
    icons,
    ...(languages ? languageMetadata(languages) : {}),
  };
}
