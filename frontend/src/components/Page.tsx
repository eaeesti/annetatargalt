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
import type { LanguageLink } from "@/utils/locale";

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
      <Banner
        topBannerText={global.topBannerText}
        closeText={global.closeText}
      />
      <Navbar global={global} languages={languages} />
      {page?.sections?.map((section) => (
        <Section
          key={section.id}
          section={section}
          global={global}
          page={page}
          entity={entity}
        />
      ))}
      <Footer global={global} languages={languages} />
    </>
  );
}
