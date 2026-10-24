import BlogHeaderSection from "./sections/BlogHeaderSection";
import BlogPostsSection from "./sections/BlogPostsSection";
import CampaignSection from "./sections/CampaignSection";
import CauseOrganizationsSection from "./sections/CauseOrganizationsSection";
import CausesSection from "./sections/CausesSection";
import ContactSection from "./sections/ContactSection";
import CtaSection from "./sections/CtaSection";
import DonationSection from "./sections/DonationSection";
import EntityTextSection from "./sections/EntityTextSection";
import FAQSection from "./sections/FaqSection";
import ForeignDonationSection from "./sections/ForeignDonationSection";
import HeaderSection from "./sections/HeaderSection";
import HeroSection from "./sections/HeroSection";
import MapSection from "./sections/MapSection";
import OrgHeaderSection from "./sections/OrgHeaderSection";
import OrganizationCtaSection from "./sections/OrganizationCtaSection";
import OrganizationsSection from "./sections/OrganizationsSection";
import PartnerSection from "./sections/PartnerSection";
import PowerSection from "./sections/PowerSection";
import RedirectSection from "./sections/RedirectSection";
import SpecialHeaderSection from "./sections/SpecialHeaderSection";
import StatsSection from "./sections/StatsSection";
import TeamSection from "./sections/TeamSection";
import TestimonialsSection from "./sections/TestimonialsSection";
import TextSection from "./sections/TextSection";
import ThankYouSection from "./sections/ThankYouSection";
import type {
  StrapiSection,
  StrapiGlobal,
  StrapiPage,
  StrapiSpecialPage,
  StrapiCause,
  StrapiOrganization,
  StrapiBlogPost,
} from "@/types/generated/strapi";

interface SectionProps {
  section: StrapiSection;
  global: StrapiGlobal;
  page: StrapiPage | StrapiSpecialPage;
  entity?: StrapiCause | StrapiOrganization | StrapiBlogPost;
}

export default function Section({
  section,
  global,
  entity,
  page,
}: SectionProps) {
  // A special page shows one entry of the collection Strapi names for it, so
  // the sections made for one kind of entry check that they got that kind.
  const cause = entity && "organizations" in entity ? entity : null;
  const organization = entity && "internalId" in entity ? entity : null;
  const blogPost = entity && "preview" in entity ? entity : null;
  // Strapi allows the sections that read a page's slug or metadata on
  // ordinary pages only, and special pages have neither.
  const ordinaryPage = "slug" in page ? page : null;

  switch (section.__component) {
    case "sections.hero-section":
      return <HeroSection {...section} />;
    case "sections.text-section":
      return <TextSection {...section} />;
    case "sections.cta-section":
      return <CtaSection {...section} />;
    case "sections.header-section":
      return <HeaderSection {...section} global={global} />;
    case "sections.causes-section":
      return <CausesSection {...section} page={page} />;
    case "sections.donation-section":
      return (
        ordinaryPage && (
          <DonationSection {...section} global={global} page={ordinaryPage} />
        )
      );
    case "sections.thank-you-section":
      return <ThankYouSection {...section} global={global} />;
    case "sections.power-section":
      return <PowerSection {...section} />;
    case "sections.team-section":
      return <TeamSection {...section} global={global} />;
    case "sections.testimonials-section":
      return <TestimonialsSection {...section} />;
    case "sections.contact-section":
      return <ContactSection {...section} global={global} />;
    case "sections.faq-section":
      return <FAQSection {...section} />;
    case "sections.stats-section":
      return <StatsSection {...section} global={global} />;
    case "sections.campaign-section":
      return <CampaignSection {...section} global={global} />;
    case "sections.redirect-section":
      return <RedirectSection {...section} />;
    case "sections.blog-posts-section":
      return (
        ordinaryPage && (
          <BlogPostsSection {...section} global={global} page={ordinaryPage} />
        )
      );
    case "sections.organizations-section":
      return <OrganizationsSection {...section} global={global} />;
    case "sections.partner-section":
      return <PartnerSection {...section} />;
    case "sections.foreign-donation-section":
      return <ForeignDonationSection {...section} global={global} />;
    case "sections.map-section":
      return <MapSection {...section} />;
    case "special-sections.special-header-section":
      return (
        entity && (
          <SpecialHeaderSection {...section} entity={entity} global={global} />
        )
      );
    case "special-sections.cause-organizations-section":
      return (
        cause && (
          <CauseOrganizationsSection
            {...section}
            entity={cause}
            global={global}
          />
        )
      );
    case "special-sections.entity-text-section":
      return entity && <EntityTextSection {...section} entity={entity} />;
    case "special-sections.org-header-section":
      return (
        organization && (
          <OrgHeaderSection
            {...section}
            entity={organization}
            global={global}
          />
        )
      );
    case "special-sections.organization-cta-section":
      return (
        organization && (
          <OrganizationCtaSection
            {...section}
            entity={organization}
            global={global}
          />
        )
      );
    case "special-sections.blog-header-section":
      return (
        blogPost && (
          <BlogHeaderSection {...section} entity={blogPost} global={global} />
        )
      );
    default:
      // `satisfies never` makes a section in the generated types without a
      // case here a type error, so this is only reached when Strapi has a
      // section the site hasn't been built with yet.
      throw new Error(
        `No component for the section ${JSON.stringify(section satisfies never)}`,
      );
  }
}
