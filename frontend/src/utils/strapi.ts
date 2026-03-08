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

type SpecialPageEntity = StrapiCause | StrapiOrganization | StrapiBlogPost;
function headersWithAuthToken(): { headers: { Authorization: string } } {
  const token = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

  return { headers: { Authorization: `Bearer ${token}` } };
}

export function getStrapiURL(path = ""): string {
  return `${
    process.env.NEXT_PUBLIC_STRAPI_API_URL || "http://127.0.0.1:1337"
  }${path}`;
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
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch ${path}:`, error);
    throw new Error(
      "Please check if your server is running and you set all the required tokens.",
    );
  }
}

export async function getPageBySlug(slug: string): Promise<StrapiPage> {
  const path = "/pages";
  const options = headersWithAuthToken();
  const urlParamsObject = {
    filters: { slug },
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

export async function getGlobal(): Promise<StrapiGlobal> {
  const path = "/global";
  const options = headersWithAuthToken();
  const urlParamsObject = { populate: "*" };

  const response = (await fetchAPI(path, urlParamsObject, options)) as {
    data: StrapiGlobal;
  };

  // Singleton types return data directly (not in an array)
  return response.data;
}

type SpecialPageWithPattern = StrapiSpecialPage & { slugPattern: string; collectionType: string };

export async function getSpecialPages(): Promise<SpecialPageWithPattern[]> {
  const path = "/special-pages";
  const options = headersWithAuthToken();
  const urlParamsObject = { populate: "*" };

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
): Promise<{ page: SpecialPageWithPattern; entity: SpecialPageEntity } | null> {
  const specialPages = await getSpecialPages();

  const foundSpecialPage = specialPages.find((specialPage) =>
    new RegExp(specialPage.slugPattern).test(slug),
  );

  if (!foundSpecialPage) return null;

  const match = slug.match(new RegExp(foundSpecialPage.slugPattern));
  if (!match) return null;
  const endpoint = match[1];

  const entity = await getEntityBySlug(foundSpecialPage.collectionType, endpoint);

  return { page: foundSpecialPage, entity: entity as SpecialPageEntity };
}

export async function getEntityBySlug(type: string, slug: string): Promise<unknown> {
  const path = `/${type}`;
  const options = headersWithAuthToken();
  const urlParamsObject = {
    filters: { slug },
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

export async function getAllSlugs(): Promise<string[]> {
  const pagesPath = "/pages";
  const options = headersWithAuthToken();
  const urlParamsObject = { populate: "*" };

  const pagesResponse = (await fetchAPI(pagesPath, urlParamsObject, options)) as {
    data: StrapiPage[];
  };
  // In Strapi v5, data is returned flat (not nested under attributes)
  const pageSlugs = pagesResponse.data?.flatMap((page) => page.slug ? [page.slug] : []) || [];

  const causesPath = "/causes";
  const causesResponse = (await fetchAPI(causesPath, urlParamsObject, options)) as {
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

  const blogPosts = await getBlogPosts();
  const global = await getGlobal();
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

export async function getBlogPosts(): Promise<StrapiBlogPost[]> {
  const path = "/blog-posts";
  const options = headersWithAuthToken();
  const urlParamsObject = { populate: "*", sort: "date:desc" };

  const response = (await fetchAPI(path, urlParamsObject, options)) as {
    data: StrapiBlogPost[];
  };

  if (!response.data || response.data.length === 0) {
    return [];
  }

  // In Strapi v5, data is returned flat (not nested under attributes)
  return response.data;
}

export function strapiSectionNameToReactComponentName(component: string): string {
  return snakeCaseToPascalCase(component.split(".")[1]);
}

export function snakeCaseToPascalCase(string: string): string {
  return string
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

export async function getOrganizations(): Promise<StrapiOrganization[]> {
  const path = "/organizations";
  const options = headersWithAuthToken();
  const urlParamsObject = {
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
