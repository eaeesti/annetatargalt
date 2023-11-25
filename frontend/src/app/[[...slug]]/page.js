import SpecialPage from "@/components/SpecialPage";
import Page from "../../components/Page";
import { buildMetadata } from "../../utils/seo";
import { getGlobal, getPageBySlug, findSpecialPage } from "../../utils/strapi";

export async function generateMetadata({ params }) {
  const global = await getGlobal();
  const specialPage = await findSpecialPage(params.slug);

  if (specialPage) {
    return buildMetadata(global.metadata, specialPage.entity.metadata);
  }

  const page = await getPageBySlug(params.slug);

  return buildMetadata(global.metadata, page.metadata);
}

export default async function SlugPage({ params }) {
  const global = await getGlobal();

  const specialPage = await findSpecialPage(params.slug);
  if (specialPage) {
    return (
      <SpecialPage
        page={specialPage.page}
        entity={specialPage.entity}
        global={global}
      />
    );
  }

  const page = await getPageBySlug(params.slug);
  return <Page page={page} global={global} />;
}
