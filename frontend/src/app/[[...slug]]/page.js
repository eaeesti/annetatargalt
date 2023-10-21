import Page from "../../components/Page";
import { buildMetadata } from "../../utils/seo";
import {
  getGlobal,
  getPageBySlug,
  getSpecialPage,
  getSpecialPages,
} from "../../utils/strapi";

export async function generateMetadata({ params }) {
  const global = await getGlobal();
  const specialPage = await getSpecialPage(params.slug);

  if (specialPage) {
    return buildMetadata(global.metadata, {});
  }

  const page = await getPageBySlug(params.slug);

  return buildMetadata(global.metadata, page.metadata);
}

export default async function SlugPage({ params }) {
  const global = await getGlobal();
  const specialPage = await getSpecialPage(params.slug);
  console.log("specialPage", specialPage);

  if (specialPage) {
    return <h1>{JSON.stringify(specialPage)}</h1>;
  }

  const page = await getPageBySlug(params.slug);

  return <Page page={page} global={global} />;
}
