import Page from "../components/Page";
import { buildMetadata } from "../utils/seo";
import { getGlobal, getPageBySlug } from "../utils/strapi";

export async function generateMetadata({ params }) {
  const page = await getPageBySlug(params.slug.join("/"));
  const global = await getGlobal();

  return buildMetadata(global.metadata, page.metadata);
}

export default async function PageRoute({ params }) {
  const page = await getPageBySlug(params.slug.join("/"));
  const global = await getGlobal();

  return <Page page={page} global={global} />;
}
