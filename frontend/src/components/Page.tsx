import Banner from "./Banner";
import Footer from "./Footer";
import Navbar from "./Navbar";
import Section from "./Section";
import type {
  StrapiGlobal,
  StrapiPage,
  StrapiSpecialPage,
  StrapiCause,
  StrapiOrganization,
  StrapiBlogPost,
} from "@/types/generated/strapi";
import { localeOf, type LanguageLink } from "@/utils/locale";
import { uiText } from "@/utils/ui-text";

interface PageProps {
  page: StrapiPage | StrapiSpecialPage;
  global: StrapiGlobal;
  entity?: StrapiCause | StrapiOrganization | StrapiBlogPost;
  /** The languages to choose between; no choice is shown without them. */
  languages?: LanguageLink[];
}

export default function Page({ page, global, entity, languages }: PageProps) {
  return (
    <>
      {/* For keyboard users: the first Tab, past the banner and the menu. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-800 focus:shadow-lg"
      >
        {uiText(localeOf(global)).skipToContent}
      </a>
      <Banner
        topBannerText={global.topBannerText}
        closeText={global.closeText}
      />
      <Navbar global={global} languages={languages} />
      {/* A column, as the page's body is, so the sections sit as before. */}
      <main id="main" className="flex flex-col">
        {page?.sections?.map((section) => (
          <Section
            key={section.id}
            section={section}
            global={global}
            page={page}
            entity={entity}
          />
        ))}
      </main>
      <Footer global={global} languages={languages} />
    </>
  );
}
