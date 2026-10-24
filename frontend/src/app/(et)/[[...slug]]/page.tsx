import { CmsPage, cmsMetadata } from "@/components/CmsRoute";
import type { PageParams } from "@/components/CmsRoute";

// Each page is rendered on its first visit and then served from the cache,
// refreshed in the background at most once a minute, like the CMS data it's
// made from. Without the (empty) list of pages to build in advance, the route
// would be rendered anew for every visitor.
export const revalidate = 60;

export function generateStaticParams(): PageParams[] {
  return [];
}

export function generateMetadata({ params }: { params: Promise<PageParams> }) {
  return cmsMetadata(params, "et");
}

export default function Page({ params }: { params: Promise<PageParams> }) {
  return <CmsPage params={params} locale="et" />;
}
