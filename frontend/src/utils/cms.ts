import qs from "qs";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import type {
  StrapiGlobal,
  StrapiPage,
  StrapiSpecialPage,
  StrapiBlogPost,
  StrapiOrganization,
  StrapiCause,
} from "@/types/generated/strapi";
import type { Locale } from "./locale";
import { getStrapiURL, readStrapiJson, StrapiHttpError } from "./strapi";

type SpecialPageEntity = StrapiCause | StrapiOrganization | StrapiBlogPost;
function headersWithAuthToken(): { headers: { Authorization: string } } {
  // Server-only by design — see the note in the backend bootstrap that writes
  // this value. Never give it a NEXT_PUBLIC_ prefix: this token can read every
  // contact submission, and that prefix would inline it into any client bundle
  // that reaches this helper.
  const token = process.env.STRAPI_API_TOKEN;

  return { headers: { Authorization: `Bearer ${token}` } };
}

/**
 * Whether this request is an editor's preview (see app/api/preview), which
 * shows drafts. Outside a request, such as while building, it never is.
 */
export async function isPreview(): Promise<boolean> {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

/** A GET from Strapi's REST API, its body trusted as in readStrapiJson. */
export async function fetchAPI<T>(
  path: string,
  urlParamsObject: Record<string, unknown> = {},
  options: RequestInit = {},
): Promise<T> {
  // A preview shows each document's latest draft, fresh on every load. A
  // document without drafts answers with what it has.
  const preview = await isPreview();
  try {
    // Merge default and user options
    const mergedOptions = {
      ...(preview
        ? { cache: "no-store" as const }
        : { next: { revalidate: 60 } }),
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    };

    // Build request URL
    const queryString = qs.stringify(
      preview ? { ...urlParamsObject, status: "draft" } : urlParamsObject,
    );
    const requestUrl = `${getStrapiURL(
      `/api${path}${queryString ? `?${queryString}` : ""}`,
    )}`;

    // Trigger API call
    const response = await fetch(requestUrl, mergedOptions);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Strapi rejected the API token (HTTP ${response.status}) for GET /api${path}. ` +
            "This usually means STRAPI_API_TOKEN in frontend/.env no longer matches a token " +
            "in the running Strapi database — which happens after restoring a production DB dump. " +
            "Fix: open http://localhost:1337/admin → Settings → API Tokens → regenerate the token, " +
            "put the new value in frontend/.env, and restart the frontend.",
        );
      }
      const body = await response.text().catch(() => "");
      throw new StrapiHttpError(
        `Strapi returned HTTP ${response.status} for GET /api${path}` +
          (body ? `: ${body.slice(0, 300)}` : ""),
        response.status,
      );
    }

    // Awaited here so that a body that isn't JSON is caught below.
    return await readStrapiJson<T>(response);
  } catch (error) {
    // rethrow our own descriptive errors untouched
    if (
      error instanceof Error &&
      (error.message.startsWith("Strapi rejected") ||
        error.message.startsWith("Strapi returned"))
    ) {
      throw error;
    }
    console.error(`Failed to fetch ${path}:`, error);
    throw new Error(
      `Could not reach Strapi at ${getStrapiURL()} for GET /api${path}. ` +
        "Check that the backend is running (pnpm dev) and NEXT_PUBLIC_STRAPI_API_URL is set.",
    );
  }
}

/**
 * Every entry of a collection. Strapi answers a list in pages, 25 entries
 * long unless asked for more and at most 100, so a site with more pages,
 * posts or organizations than that needs them all fetched.
 */
export async function fetchAllAPI<T>(
  path: string,
  urlParamsObject: Record<string, unknown> = {},
  options: RequestInit = {},
): Promise<T[]> {
  const entries: T[] = [];
  for (let page = 1; ; page++) {
    const response = await fetchAPI<{
      data?: T[];
      meta?: { pagination?: { pageCount?: number } };
    }>(
      path,
      { ...urlParamsObject, pagination: { page, pageSize: 100 } },
      options,
    );
    entries.push(...(response.data ?? []));
    if (page >= (response.meta?.pagination?.pageCount ?? 1)) return entries;
  }
}

export async function getPageBySlug(
  slug: string,
  locale: Locale,
): Promise<StrapiPage> {
  const path = "/pages";
  const options = headersWithAuthToken();
  // populate "*" includes localizations: the page's slug in the other language.
  const urlParamsObject = {
    filters: { slug },
    locale,
    populate: "*",
  };

  const response = await fetchAPI<{ data: StrapiPage[] }>(
    path,
    urlParamsObject,
    options,
  );

  if (!response.data || response.data.length === 0) {
    notFound();
  }

  try {
    // In Strapi v5, data is returned flat (not nested under attributes)
    return response.data[0];
  } catch (error) {
    notFound();
  }
}

/**
 * A language's global settings, or null when it has none yet. Callers outside
 * a page render use this; pages use getGlobal().
 */
export async function findGlobal(locale: Locale): Promise<StrapiGlobal | null> {
  const path = "/global";
  const options = headersWithAuthToken();
  const urlParamsObject = { locale, populate: "*" };

  try {
    const response = await fetchAPI<{ data: StrapiGlobal }>(
      path,
      urlParamsObject,
      options,
    );
    // Singleton types return data directly (not in an array)
    return response.data;
  } catch (error) {
    if (error instanceof StrapiHttpError && error.status === 404) return null;
    throw error;
  }
}

/** A language's global settings; a language without them has no site. */
export async function getGlobal(locale: Locale): Promise<StrapiGlobal> {
  const global = await findGlobal(locale);
  if (!global) notFound();
  return global;
}

type SpecialPageWithPattern = StrapiSpecialPage & {
  slugPattern: string;
  collectionType: string;
};

export async function getSpecialPages(
  locale: Locale,
): Promise<SpecialPageWithPattern[]> {
  const path = "/special-pages";
  const options = headersWithAuthToken();
  const urlParamsObject = { locale, populate: "*" };

  const specialPages = await fetchAllAPI<StrapiSpecialPage>(
    path,
    urlParamsObject,
    options,
  );

  // In Strapi v5, data is returned flat (not nested under attributes)
  return specialPages.filter(
    (page): page is SpecialPageWithPattern =>
      Boolean(page?.slugPattern) && Boolean(page?.collectionType),
  );
}

export async function findSpecialPage(
  slug: string,
  locale: Locale,
): Promise<{ page: SpecialPageWithPattern; entity: SpecialPageEntity } | null> {
  // Each language has its own special pages, so its own slug patterns.
  const specialPages = await getSpecialPages(locale);

  const foundSpecialPage = specialPages.find((specialPage) =>
    new RegExp(specialPage.slugPattern).test(slug),
  );

  if (!foundSpecialPage) return null;

  const match = slug.match(new RegExp(foundSpecialPage.slugPattern));
  if (!match) return null;
  const endpoint = match[1];

  const entity = await getEntityBySlug(
    foundSpecialPage.collectionType,
    endpoint,
    locale,
  );

  return { page: foundSpecialPage, entity };
}

export async function getEntityBySlug(
  type: string,
  slug: string,
  locale: Locale,
): Promise<SpecialPageEntity> {
  const path = `/${type}`;
  const options = headersWithAuthToken();
  const urlParamsObject = {
    filters: { slug },
    locale,
    populate: "*",
  };

  const response = await fetchAPI<{ data: SpecialPageEntity[] }>(
    path,
    urlParamsObject,
    options,
  );

  if (!response.data || response.data.length === 0) {
    notFound();
  }

  try {
    // In Strapi v5, data is returned flat (already includes id)
    return response.data[0];
  } catch (error) {
    notFound();
  }
}

/**
 * The same document in another language, or null when it has no translation
 * there (Strapi answers 404).
 */
export async function fetchEntityInLocale(
  type: string,
  documentId: string,
  locale: Locale,
): Promise<SpecialPageEntity | null> {
  try {
    const response = await fetchAPI<{ data?: SpecialPageEntity }>(
      `/${type}/${documentId}`,
      { locale, populate: "*" },
      headersWithAuthToken(),
    );
    return response.data ?? null;
  } catch {
    return null;
  }
}

export async function getAllSlugs(locale: Locale): Promise<string[]> {
  const pagesPath = "/pages";
  const options = headersWithAuthToken();
  const urlParamsObject = { locale, populate: "*" };

  const pages = await fetchAllAPI<StrapiPage>(
    pagesPath,
    urlParamsObject,
    options,
  );
  // In Strapi v5, data is returned flat (not nested under attributes)
  // Unlisted pages are reachable by their link only, so they're left out.
  const pageSlugs = pages.flatMap((page) =>
    page.slug && !page.metadata?.unlisted ? [page.slug] : [],
  );

  const causesPath = "/causes";
  const causes = await fetchAllAPI<{
    slug: string;
    organizations?: Array<{ slug: string }>;
  }>(causesPath, urlParamsObject, options);
  const causeSlugs = causes.map((cause) => cause.slug);

  const organizationSlugs = causes
    .map((cause) =>
      (cause.organizations || []).map(
        (organization) => `${cause.slug}/${organization.slug}`,
      ),
    )
    .flat();

  const blogPosts = await getBlogPosts(locale);
  const global = await getGlobal(locale);
  const blogPostSlugs = blogPosts.map(
    (blogPost) => `${global?.blogSlug || "blog"}/${blogPost.slug}`,
  );

  const allSlugs = [
    ...pageSlugs,
    ...causeSlugs,
    ...organizationSlugs,
    ...blogPostSlugs,
  ];

  return allSlugs;
}

export async function getBlogPosts(locale: Locale): Promise<StrapiBlogPost[]> {
  const path = "/blog-posts";
  const options = headersWithAuthToken();
  const urlParamsObject = { locale, populate: "*", sort: "date:desc" };

  // In Strapi v5, data is returned flat (not nested under attributes)
  return fetchAllAPI<StrapiBlogPost>(path, urlParamsObject, options);
}

export async function getOrganizations(
  locale: Locale,
): Promise<StrapiOrganization[]> {
  const path = "/organizations";
  const options = headersWithAuthToken();
  const urlParamsObject = {
    locale,
    populate: "*",
    sort: "title:asc",
    // An inactive organization takes no donations, so it isn't listed.
    filters: {
      active: { $eq: true },
      cause: {
        id: {
          $notNull: true,
        },
      },
    },
  };

  // In Strapi v5, data is returned flat (already includes id)
  return fetchAllAPI<StrapiOrganization>(path, urlParamsObject, options);
}
