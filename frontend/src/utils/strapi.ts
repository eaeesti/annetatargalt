import qs from "qs";
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

type SpecialPageEntity = StrapiCause | StrapiOrganization | StrapiBlogPost;
function headersWithAuthToken(): { headers: { Authorization: string } } {
  // Server-only by design — see the note in the backend bootstrap that writes
  // this value. Never give it a NEXT_PUBLIC_ prefix: this token can read every
  // contact submission, and that prefix would inline it into any client bundle
  // that reaches this helper.
  const token = process.env.STRAPI_API_TOKEN;

  return { headers: { Authorization: `Bearer ${token}` } };
}

export function getStrapiURL(path = ""): string {
  return `${
    process.env.NEXT_PUBLIC_STRAPI_API_URL || "http://127.0.0.1:1337"
  }${path}`;
}

/**
 * What to show the user when a request to Strapi fails: Strapi's own
 * "Name: message" when the body is a Strapi error, otherwise the HTTP status.
 * A body that isn't Strapi's is a proxy's error page, which means nothing to
 * a donor.
 */
export async function describeErrorResponse(
  response: Response,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    const error =
      typeof body === "object" && body !== null && "error" in body
        ? body.error
        : null;
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      "message" in error &&
      typeof error.name === "string" &&
      typeof error.message === "string"
    ) {
      return `${error.name}: ${error.message}`;
    }
  } catch {
    // Not JSON: fall through to the status.
  }
  return `${response.status} ${response.statusText}`.trim();
}

/** A response from Strapi that wasn't a success, with its HTTP status. */
export class StrapiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchAPI(
  path: string,
  urlParamsObject: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
): Promise<unknown> {
  try {
    // Merge default and user options
    const mergedOptions = {
      next: { revalidate: 60 },
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    };

    // Build request URL
    const queryString = qs.stringify(urlParamsObject);
    const requestUrl = `${getStrapiURL(
      `/api${path}${queryString ? `?${queryString}` : ""}`,
    )}`;

    // Trigger API call
    const response = await fetch(requestUrl, mergedOptions as RequestInit);

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

    const data = await response.json();
    return data;
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
        "Check that the backend is running (pnpm develop) and NEXT_PUBLIC_STRAPI_API_URL is set.",
    );
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

  const response = (await fetchAPI(path, urlParamsObject, options)) as {
    data: StrapiPage[];
  };

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
    const response = (await fetchAPI(path, urlParamsObject, options)) as {
      data: StrapiGlobal;
    };
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

  const response = (await fetchAPI(path, urlParamsObject, options)) as {
    data: StrapiSpecialPage[];
  };

  if (!response.data || response.data.length === 0) {
    return [];
  }

  // In Strapi v5, data is returned flat (not nested under attributes)
  return response.data.filter(
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

  return { page: foundSpecialPage, entity: entity as SpecialPageEntity };
}

export async function getEntityBySlug(
  type: string,
  slug: string,
  locale: Locale,
): Promise<unknown> {
  const path = `/${type}`;
  const options = headersWithAuthToken();
  const urlParamsObject = {
    filters: { slug },
    locale,
    populate: "*",
  };

  const response = (await fetchAPI(path, urlParamsObject, options)) as {
    data: unknown[];
  };

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
    const response = (await fetchAPI(
      `/${type}/${documentId}`,
      { locale, populate: "*" },
      headersWithAuthToken(),
    )) as { data?: SpecialPageEntity };
    return response.data ?? null;
  } catch {
    return null;
  }
}

export async function getAllSlugs(locale: Locale): Promise<string[]> {
  const pagesPath = "/pages";
  const options = headersWithAuthToken();
  const urlParamsObject = { locale, populate: "*" };

  const pagesResponse = (await fetchAPI(
    pagesPath,
    urlParamsObject,
    options,
  )) as {
    data: StrapiPage[];
  };
  // In Strapi v5, data is returned flat (not nested under attributes)
  const pageSlugs =
    pagesResponse.data?.flatMap((page) => (page.slug ? [page.slug] : [])) || [];

  const causesPath = "/causes";
  const causesResponse = (await fetchAPI(
    causesPath,
    urlParamsObject,
    options,
  )) as {
    data: Array<{ slug: string; organizations?: Array<{ slug: string }> }>;
  };
  const causes = causesResponse.data || [];
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

  const response = (await fetchAPI(path, urlParamsObject, options)) as {
    data: StrapiBlogPost[];
  };

  if (!response.data || response.data.length === 0) {
    return [];
  }

  // In Strapi v5, data is returned flat (not nested under attributes)
  return response.data;
}

export function strapiSectionNameToReactComponentName(
  component: string,
): string {
  return snakeCaseToPascalCase(component.split(".")[1]);
}

export function snakeCaseToPascalCase(string: string): string {
  return string
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
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
    filters: {
      cause: {
        id: {
          $notNull: true,
        },
      },
    },
  };

  const response = (await fetchAPI(path, urlParamsObject, options)) as {
    data: StrapiOrganization[];
  };

  if (!response.data || response.data.length === 0) {
    return [];
  }

  // In Strapi v5, data is returned flat (already includes id)
  return response.data;
}
