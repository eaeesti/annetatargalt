import Page from "../../components/Page";
import { buildMetadata } from "../../utils/seo";
import { getGlobal, getPageBySlug, findSpecialPage } from "../../utils/strapi";

function getSlug(params) {
  if (!params.slug) return "/";
  if (params.slug.length === 0) return "/";
  if (params.slug.length === 1 && params.slug[0] === "index") return "/";
  return params.slug.join("/");
}

export async function generateMetadata({ params }) {
  const slug = getSlug(params);
  const global = await getGlobal();
  const specialPage = await findSpecialPage(slug);

  if (specialPage) {
    return buildMetadata(global.metadata, specialPage.entity.metadata);
  }

  const page = await getPageBySlug(slug);

  return buildMetadata(global.metadata, page.metadata);
}

export default async function SlugPage({ params }) {
  const slug = getSlug(params);
  const global = await getGlobal();

  const specialPage = await findSpecialPage(slug);
  if (specialPage) {
    return (
      <Page
        page={specialPage.page}
        entity={specialPage.entity}
        global={global}
      />
    );
  }

  const page = await getPageBySlug(slug);
  return <Page page={page} global={global} />;
}
