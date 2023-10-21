import qs from "qs";

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
      `/api${path}${queryString ? `?${queryString}` : ""}`
    )}`;

    // Trigger API call
    const response = await fetch(requestUrl, mergedOptions);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw new Error(
      `Please check if your server is running and you set all the required tokens.`
    );
  }
}

export async function getPageBySlug(slugArray) {
  const slug = slugArray ? slugArray.join("/") : "/";

  const path = `/pages`;
  const options = headersWithAuthToken();
  const urlParamsObject = {
    filters: { slug },
    populate: "deep",
  };

  const response = await fetchAPI(path, urlParamsObject, options);

  try {
    return response.data[0].attributes;
  } catch (error) {
    throw new Error(`Page with slug ${slug} not found`);
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
  const options = headersWithAuthToken();
  const urlParamsObject = { populate: "deep" };

  const pagesData = [
    {
      pageName: "CausePage",
      path: "/cause-page",
    },
    {
      pageName: "OrganizationPage",
      path: "/organization-page",
    },
  ];

  const fetches = pagesData.map(({ pageName, path }) => {
    const promise = fetchAPI(path, urlParamsObject, options);
    return { pageName, promise };
  });

  const returns = await Promise.all(fetches.map(({ promise }) => promise));

  const pages = pagesData.map(({ pageName }, i) => ({
    pageName,
    specialPage: returns[i].data.attributes,
  }));

  return pages;
}

export async function getSpecialPage(slugArray) {
  const specialPages = await getSpecialPages();

  const slug = slugArray ? slugArray.join("/") : "/";

  for (let { pageName, specialPage } of specialPages) {
    console.log(pageName, specialPage);
    const slugMatcher = new RegExp(specialPage.slugPattern);
    const matches = slug.match(slugMatcher);
    if (!matches) continue;

    const endpoint = matches[1];
    return { pageName, specialPage, endpoint };
  }
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
