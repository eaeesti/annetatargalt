import type { Metadata } from "next";
import Page from "./Page";
import { buildMetadata } from "@/utils/seo";
import {
  fetchEntityInLocale,
  findGlobal,
  findSpecialPage,
  getGlobal,
  getPageBySlug,
} from "@/utils/cms";
import { isLocale, LOCALES, pagePath } from "@/utils/locale";
import type { LanguageLink, Locale } from "@/utils/locale";
import type {
  StrapiBlogPost,
  StrapiCause,
  StrapiGlobal,
  StrapiOrganization,
  StrapiPage,
  StrapiSpecialPage,
} from "@/types/generated/strapi";

export interface PageParams {
  slug?: string[];
}

type Entity = StrapiCause | StrapiOrganization | StrapiBlogPost;

interface ResolvedPage {
  global: StrapiGlobal;
  page: StrapiPage | StrapiSpecialPage;
  entity?: Entity;
  metadata: StrapiPage["metadata"] | undefined;
  /** This page's path in its language and each public one that has it. */
  paths: Partial<Record<Locale, string>>;
  /** The languages a visitor can choose between, if any. */
  languages: LanguageLink[];
}

function getSlug(params: PageParams): string {
  if (!params.slug || params.slug.length === 0) return "/";
  if (params.slug.length === 1 && params.slug[0] === "index") return "/";
  return params.slug.join("/");
}

/**
 * The slug an entity is served at, the same way the sections link to it:
 * a cause's slug is its whole path, an organization sits under its cause and
 * a blog post under the blog page.
 */
function entitySlug(
  collectionType: string,
  entity: Entity,
  global: StrapiGlobal,
): string | null {
  if (collectionType === "causes" && "organizations" in entity) {
    return entity.slug;
  }
  if (collectionType === "organizations" && "internalId" in entity) {
    return entity.cause?.slug && entity.slug
      ? `${entity.cause.slug}/${entity.slug}`
      : null;
  }
  if (collectionType === "blog-posts" && "preview" in entity) {
    return global.blogSlug && entity.slug
      ? `${global.blogSlug}/${entity.slug}`
      : null;
  }
  return null;
}

/**
 * Each public language's name in itself. A language without a name is still
 * being reviewed, so nothing links to it.
 */
async function languageNames(): Promise<Partial<Record<Locale, string>>> {
  const globals = await Promise.all(
    LOCALES.map((locale) => findGlobal(locale)),
  );
  return Object.fromEntries(
    LOCALES.flatMap((locale, i) => {
      const name = globals[i]?.languageName?.trim();
      return name ? [[locale, name]] : [];
    }),
  );
}

/**
 * The languages to choose between: none until this one is public and another
 * is too. A page missing in a language links to that language's home page.
 */
function languageLinks(
  locale: Locale,
  names: Partial<Record<Locale, string>>,
  paths: Partial<Record<Locale, string>>,
): LanguageLink[] {
  if (!names[locale]) return [];
  const links = LOCALES.flatMap((other) => {
    const name = names[other];
    return name
      ? [{ locale: other, name, href: paths[other] ?? pagePath("/", other) }]
      : [];
  });
  return links.length > 1 ? links : [];
}

async function resolvePage(
  slug: string,
  locale: Locale,
): Promise<ResolvedPage> {
  const [global, names] = await Promise.all([
    getGlobal(locale),
    languageNames(),
  ]);
  const others = LOCALES.filter((other) => other !== locale && names[other]);
  const paths: Partial<Record<Locale, string>> = {
    [locale]: pagePath(slug, locale),
  };

  const special = await findSpecialPage(slug, locale);
  if (special) {
    const { page, entity } = special;
    await Promise.all(
      others.map(async (other) => {
        // An organization's path in another language needs its cause there
        // too, which the localizations list doesn't carry, so fetch the whole
        // translation.
        const translation = await fetchEntityInLocale(
          page.collectionType,
          entity.documentId,
          other,
        );
        const otherSlug =
          translation &&
          entitySlug(page.collectionType, translation, await getGlobal(other));
        if (otherSlug) paths[other] = pagePath(otherSlug, other);
      }),
    );
    return {
      global,
      page,
      entity,
      metadata: entity.metadata,
      paths,
      languages: languageLinks(locale, names, paths),
    };
  }

  const page = await getPageBySlug(slug, locale);
  for (const localization of page.localizations ?? []) {
    const other = localization.locale;
    if (isLocale(other) && others.includes(other) && localization.slug) {
      paths[other] = pagePath(localization.slug, other);
    }
  }
  return {
    global,
    page,
    metadata: page.metadata,
    paths,
    languages: languageLinks(locale, names, paths),
  };
}

/** Whether a language's version is public: it has its name. */
export function isLaunched(global: StrapiGlobal): boolean {
  return Boolean(global.languageName?.trim());
}

export async function layoutMetadata(locale: Locale): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const global = await getGlobal(locale);
    return {
      ...buildMetadata(global, {}),
      // Resolves the relative canonical and hreflang paths pages set.
      ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
    };
  } catch {
    // Let the page's own fetches throw so error.tsx can show the actionable
    // message; don't blow up metadata generation here.
    return {};
  }
}

export async function cmsMetadata(
  params: Promise<PageParams>,
  locale: Locale,
): Promise<Metadata> {
  const slug = getSlug(await params);
  try {
    const { global, metadata, paths } = await resolvePage(slug, locale);
    return buildMetadata(global, metadata ?? {}, {
      locale,
      paths,
      launched: isLaunched(global),
    });
  } catch (err) {
    // Let notFound()/redirect() through; swallow real fetch failures so the
    // actionable error comes from the page render (→ error.tsx), not here.
    if (
      err instanceof Error &&
      "digest" in err &&
      typeof err.digest === "string"
    ) {
      throw err;
    }
    return {};
  }
}

export async function CmsPage({
  params,
  locale,
}: {
  params: Promise<PageParams>;
  locale: Locale;
}) {
  const slug = getSlug(await params);
  const { global, page, entity, languages } = await resolvePage(slug, locale);

  return (
    <Page page={page} entity={entity} global={global} languages={languages} />
  );
}
