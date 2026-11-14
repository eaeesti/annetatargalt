import { cmsShareCard } from "@/components/CmsRoute";
import { isLocale } from "@/utils/locale";
import { pageOfCard } from "@/utils/share-card";
import { shareCardResponse } from "@/utils/share-card-image";

interface Context {
  params: Promise<{ locale: string; slug?: string[] }>;
}

// A page's share card (utils/share-card.ts). Like the pages, it's drawn on
// the first request and cached, refreshed in the background at most once a
// minute. Its address changes with what's on it, so a link preview made
// before an edit keeps the card it had.
export const dynamic = "force-static";
export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: Context) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  return shareCardResponse(await cmsShareCard(pageOfCard(slug), locale));
}
