import Banner from "./Banner";
import Footer from "./Footer";
import Navbar from "./Navbar";
import Section from "./Section";
import type { StrapiGlobal, StrapiPage, StrapiCause, StrapiOrganization, StrapiBlogPost } from "@/types/generated/strapi";

interface PageProps {
  page: StrapiPage;
  global: StrapiGlobal;
  entity?: StrapiCause | StrapiOrganization | StrapiBlogPost;
}

export default function Page({ page, global, entity }: PageProps) {
  return (
    <>
      <Banner
        topBannerText={global.topBannerText}
        closeText={global.closeText}
      />
      <Navbar global={global} />
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
