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

interface PageProps {
  page: StrapiPage | StrapiSpecialPage;
  global: StrapiGlobal;
  entity?: StrapiCause | StrapiOrganization | StrapiBlogPost;
  /** This page in the other language; no switch is shown without it. */
  languageSwitchHref?: string;
}

export default function Page({
  page,
  global,
  entity,
  languageSwitchHref,
}: PageProps) {
  return (
    <>
      <Banner
        topBannerText={global.topBannerText}
        closeText={global.closeText}
      />
      <Navbar global={global} languageSwitchHref={languageSwitchHref} />
      {page?.sections?.map((section) => (
        <Section
          key={section.id}
          section={section}
          global={global}
          page={page}
          entity={entity}
        />
      ))}
      <Footer global={global} />
    </>
  );
}
