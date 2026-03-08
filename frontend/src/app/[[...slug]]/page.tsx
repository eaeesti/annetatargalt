import Page from "../../components/Page";
import { buildMetadata } from "../../utils/seo";
import { getGlobal, getPageBySlug, findSpecialPage } from "../../utils/strapi";
import type { StrapiPage, StrapiCause, StrapiOrganization, StrapiBlogPost } from "@/types/generated/strapi";
import type { Metadata } from "next";

interface PageParams {
  slug?: string[];
}

function getSlug(params: PageParams): string {
  if (!params.slug) return "/";
  if (params.slug.length === 0) return "/";
  if (params.slug.length === 1 && params.slug[0] === "index") return "/";
  return params.slug.join("/");
}

export async function generateMetadata(
  { params }: { params: Promise<PageParams> },
): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = getSlug(resolvedParams);
  const global = await getGlobal();
  const specialPage = await findSpecialPage(slug);

  if (specialPage) {
    return buildMetadata(global, (specialPage.entity as any)?.metadata ?? {});
  }

  const page = await getPageBySlug(slug);

  return buildMetadata(global, page.metadata);
}

export default async function SlugPage({ params }: { params: Promise<PageParams> }) {
  const resolvedParams = await params;
  const slug = getSlug(resolvedParams);
  const global = await getGlobal();

  const specialPage = await findSpecialPage(slug);
  if (specialPage) {
    return (
      <Page
        page={specialPage.page as unknown as StrapiPage}
        entity={specialPage.entity as StrapiCause | StrapiOrganization | StrapiBlogPost}
        global={global}
      />
    );
  }

  const page = await getPageBySlug(slug);
  return <Page page={page} global={global} />;
}
