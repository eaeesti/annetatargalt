import { CmsPage, cmsMetadata } from "@/components/CmsRoute";
import type { PageParams } from "@/components/CmsRoute";

export function generateMetadata({ params }: { params: Promise<PageParams> }) {
  return cmsMetadata(params, "en");
}

export default function Page({ params }: { params: Promise<PageParams> }) {
  return <CmsPage params={params} locale="en" />;
}
