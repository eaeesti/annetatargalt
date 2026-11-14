import type {
  StrapiGlobal,
  StrapiHeroSection,
  StrapiImage,
  StrapiMetadata,
  StrapiPage,
  StrapiSpecialPage,
} from "@/types/generated/strapi";
import type { Locale } from "./locale";

/**
 * A page's share card: the image link previews show, drawn by the route in
 * app/og/ (utils/share-card-image.tsx) in the style of the home page's hero.
 */
export interface ShareCard {
  /** The site's name, next to the logo. */
  site: string;
  title: string;
  subtitle: string | null;
  /** An organization's logo, as its page shows it, above its name. */
  logo: string | null;
  /**
   * The photo behind the text; none is plain green. Never the share image in
   * Site settings: that's a finished picture, with words of its own.
   */
  photo: SharePhoto | null;
}

export interface SharePhoto {
  url: string;
  /** Which part of the photo stays in view, from 0 (its top) to 1. */
  focus: number;
}

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

/**
 * Part of every card's version: change it when the cards' design changes, so
 * sites that keep link previews fetch the new ones.
 */
const DESIGN_VERSION = 2;

/** The hero's imagePosition, as the part of the photo it keeps in view. */
const FOCUS: Record<NonNullable<StrapiHeroSection["imagePosition"]>, number> = {
  top: 0,
  upper: 0.25,
  center: 0.5,
  lower: 0.75,
  bottom: 1,
};

/** What a card is made of: a CMS or special page, and the entity it shows. */
type CardPage = Pick<StrapiPage | StrapiSpecialPage, "name" | "sections"> & {
  metadata?: StrapiMetadata | null;
};
type CardEntity = {
  title: string | null;
  metadata: StrapiMetadata | null;
  image?: StrapiImage | null;
  logo?: StrapiImage | null;
};
type CardGlobal = Pick<StrapiGlobal, "title">;

/**
 * A page's card: a CMS page's hero (its title, subtitle and photo) or header,
 * or a cause's, organization's or blog post's title and picture.
 */
export function shareCard(
  page: CardPage,
  entity: CardEntity | undefined,
  global: CardGlobal,
): ShareCard {
  const site = global.title ?? "";
  if (entity) {
    const picture = entity.image?.file?.url;
    return {
      site,
      title: entity.title || entity.metadata?.title || site,
      subtitle: null,
      logo: entity.logo?.file?.url ?? null,
      photo: picture ? { url: picture, focus: 0.5 } : null,
    };
  }
  const title = page.metadata?.title || page.name || site;
  const first = page.sections?.[0];
  if (first?.__component === "sections.hero-section") {
    const url = first.image?.file?.url;
    return {
      site,
      title: first.title || title,
      subtitle: first.subtitle || null,
      logo: null,
      photo: url ? { url, focus: FOCUS[first.imagePosition ?? "lower"] } : null,
    };
  }
  if (first?.__component === "sections.header-section") {
    return {
      site,
      title: first.title || title,
      subtitle: first.subtitle || null,
      logo: null,
      photo: null,
    };
  }
  return { site, title, subtitle: null, logo: null, photo: null };
}

/** Where a page's card is drawn: /og/et for the home page, /og/en/faq. */
export function shareCardPath(slug: string, locale: Locale): string {
  return `/og/${locale}${slug === "/" ? "" : `/${slug.replace(/^\/+/, "")}`}`;
}

/** The page a card is for, from the card's path segments, as pages read theirs. */
export function pageOfCard(segments: string[] | undefined): string {
  return segments?.length ? segments.join("/") : "/";
}

/**
 * The card as the page's share image. Its address ends in a version that
 * changes with the card, since Facebook and others keep previews by address.
 */
export function shareCardImage(path: string, card: ShareCard) {
  return {
    url: `${path}?v=${hashString(JSON.stringify([DESIGN_VERSION, card]))}`,
    ...SHARE_CARD_SIZE,
    alt: card.title,
  };
}

/**
 * A short, stable fingerprint of a string (djb2), for telling versions of
 * something apart. Not for anything secret.
 */
export function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Cuts text at a word to at most `max` characters, with "…". */
export function shorten(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** Long titles get smaller type, so they fit in three lines. */
export function titleFontSize(title: string): number {
  if (title.length <= 22) return 84;
  if (title.length <= 40) return 70;
  if (title.length <= 70) return 58;
  return 48;
}

/**
 * A Cloudinary photo as a JPEG no wider than the card needs, so the card
 * doesn't fetch (and cache) the whole upload: the renderer can't read WebP,
 * which most uploads are, and needs only 1200 pixels across. Other addresses
 * are fetched as they are.
 */
export function cardPhotoUrl(url: string): string {
  return cloudinary(url, `f_jpg,q_85,w_${SHARE_CARD_SIZE.width},c_limit`);
}

/** How large an organization's logo is drawn: as on its page, 160 pixels. */
export const LOGO_SIZE = 160;

/**
 * A logo as a PNG at twice the size it's drawn: the renderer can't read SVG,
 * which most logos are.
 */
export function cardLogoUrl(url: string): string {
  return cloudinary(url, `f_png,w_${LOGO_SIZE * 2},h_${LOGO_SIZE * 2},c_pad`);
}

/** A Cloudinary image's address with a transformation, others as they are. */
function cloudinary(url: string, transformation: string): string {
  return url.replace(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/,
    `$1${transformation}/`,
  );
}
