import Page from "../components/Page";
import { buildMetadata } from "../utils/seo";
import { getGlobal, getPageBySlug } from "../utils/strapi";

export async function generateMetadata() {
  const page = await getPageBySlug("/");
  const global = await getGlobal();

  return buildMetadata(global.metadata, page.metadata);
}

export default async function Home() {
  const page = await getPageBySlug("/");
  const global = await getGlobal();

  return <Page page={page} global={global} />;
}
