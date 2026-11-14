import type { Metadata } from "next";
import type { StrapiGlobal, StrapiMetadata } from "@/types/generated/strapi";
import { DEFAULT_LOCALE } from "./locale";
import { imageSource } from "./image";
import type { Locale } from "./locale";

/** og:locale, as Facebook and others expect it. */
const OPEN_GRAPH_LOCALES: Record<Locale, string> = { et: "et_EE", en: "en_GB" };

/** An image to share a page with: its address, size and description. */
export interface ShareImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

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

/**
 * og:locale for the page's language, and og:locale:alternate for each other
 * language it's public in.
 */
function openGraphLocales({ locale, paths, launched }: Languages) {
  const alternates = launched
    ? Object.keys(paths).filter(
        (other): other is Locale =>
          other !== locale && other in OPEN_GRAPH_LOCALES,
      )
    : [];
  return {
    locale: OPEN_GRAPH_LOCALES[locale],
    ...(alternates.length
      ? {
          alternateLocale: alternates.map((other) => OPEN_GRAPH_LOCALES[other]),
        }
      : {}),
  };
}

/**
 * A page's metadata. Its link previews show the share image set on it in
 * Strapi, or else `card` (utils/share-card.ts), or else the one in Site
 * settings.
 */
export function buildMetadata(
  global: StrapiGlobal,
  pageMetadata: Partial<StrapiMetadata>,
  languages?: Languages,
  card?: ShareImage,
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

  const uploaded =
    imageSource(pageMetadata.shareImage) ??
    (card ? null : imageSource(globalMetadata?.shareImage));
  const shareImage = uploaded
    ? {
        url: uploaded.file.url,
        width: uploaded.file.width ?? undefined,
        height: uploaded.file.height ?? undefined,
        alt: uploaded.alt || undefined,
      }
    : card;

  const openGraph: Metadata["openGraph"] = {
    ...(languages ? openGraphLocales(languages) : {}),
    ...(shareImage ? { images: [shareImage] } : {}),
  };

  return {
    title,
    description:
      pageMetadata.description ?? globalMetadata?.description ?? null,
    openGraph,
    // A wide preview on X and the like, as on Facebook
    ...(shareImage ? { twitter: { card: "summary_large_image" } } : {}),
    icons,
    ...(languages ? languageMetadata(languages) : {}),
    // A page that's still being reviewed is reachable by its link, but asks
    // not to be indexed; the sitemap leaves it out too.
    ...(pageMetadata.unlisted ? { robots: { index: false } } : {}),
  };
}
