import qs from "qs";
import { notFound } from "next/navigation";

function headersWithAuthToken() {
  const token = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

  return { headers: { Authorization: `Bearer ${token}` } };
}

export function getStrapiURL(path = "") {
  return `${
    process.env.NEXT_PUBLIC_STRAPI_API_URL || "http://127.0.0.1:1337"
  }${path}`;
}

export async function fetchAPI(path, urlParamsObject = {}, options = {}) {
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
    const response = await fetch(requestUrl, mergedOptions);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw new Error(
      "Please check if your server is running and you set all the required tokens.",
    );
  }
}

export async function getPageBySlug(slug) {
  const path = "/pages";
  const options = headersWithAuthToken();
  const urlParamsObject = {
    filters: { slug },
    populate: "deep",
  };

  const response = await fetchAPI(path, urlParamsObject, options);

  try {
    return response.data[0].attributes;
  } catch (error) {
    notFound();
  }
}

export async function getGlobal() {
  const path = "/global";
  const options = headersWithAuthToken();
  const urlParamsObject = { populate: "deep" };

  const response = await fetchAPI(path, urlParamsObject, options);

  return response.data.attributes;
}

export async function getSpecialPages() {
  const path = "/special-pages";
  const options = headersWithAuthToken();
  const urlParamsObject = { populate: "deep,3" };

  const response = await fetchAPI(path, urlParamsObject, options);

  const specialPages = response.data.map(({ attributes }) => attributes);

  return specialPages;
}

export async function findSpecialPage(slug) {
  const specialPages = await getSpecialPages();

  const foundSpecialPage = specialPages.find((specialPage) => {
    const slugMatcher = new RegExp(specialPage.slugPattern);
    return slugMatcher.test(slug);
  });

  if (!foundSpecialPage) return null;

  const slugMatcher = new RegExp(foundSpecialPage.slugPattern);
  const endpoint = slug.match(slugMatcher)[1];

  const entity = await getEntityBySlug(
    foundSpecialPage.collectionType,
    endpoint,
  );

  return { page: foundSpecialPage, entity };
}

export async function getEntityBySlug(type, slug) {
  const path = `/${type}`;
  const options = headersWithAuthToken();
  const urlParamsObject = {
    filters: { slug },
    populate: "deep,3",
  };

  const response = await fetchAPI(path, urlParamsObject, options);

  try {
    return response.data[0].attributes;
  } catch (error) {
    notFound();
  }
}

export async function getAllSlugs() {
  const pagesPath = "/pages";
  const options = headersWithAuthToken();
  const urlParamsObject = { populate: "deep,2" };

  const pagesResponse = await fetchAPI(pagesPath, urlParamsObject, options);
  const pageSlugs = pagesResponse.data.map(({ attributes }) => attributes.slug);

  const causesPath = "/causes";
  const causesResponse = await fetchAPI(causesPath, urlParamsObject, options);
  const causes = causesResponse.data.map(({ attributes }) => attributes);
  const causeSlugs = causes.map((cause) => cause.slug);

  const organizationSlugs = causes
    .map((cause) =>
      cause.organizations.data.map(
        (organization) => `${cause.slug}/${organization.attributes.slug}`,
      ),
    )
    .flat();

  const blogPosts = await getBlogPosts();
  const global = await getGlobal();
  const blogPostSlugs = blogPosts.map(
    (blogPost) => `${global.blogSlug}/${blogPost.slug}`,
  );

  const allSlugs = [
    ...pageSlugs,
    ...causeSlugs,
    ...organizationSlugs,
    ...blogPostSlugs,
  ];
  console.log(allSlugs);

  return allSlugs;
}

export async function getBlogPosts() {
  const path = "/blog-posts";
  const options = headersWithAuthToken();
  const urlParamsObject = { populate: "deep,2", sort: "date:desc" };

  const response = await fetchAPI(path, urlParamsObject, options);

  const blogPosts = response.data.map(({ attributes }) => attributes);

  return blogPosts;
}

export function strapiSectionNameToReactComponentName(component) {
  return snakeCaseToPascalCase(component.split(".")[1]);
}

export function snakeCaseToPascalCase(string) {
  return string
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
