import type { Schema, Attribute } from '@strapi/strapi';

export interface ElementsBreadcrumb extends Schema.Component {
  collectionName: 'components_elements_breadcrumbs';
  info: {
    displayName: 'Breadcrumb';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    href: Attribute.String;
  };
}

export interface ElementsButton extends Schema.Component {
  collectionName: 'components_elements_buttons';
  info: {
    displayName: 'Button';
    description: '';
  };
  attributes: {
    text: Attribute.String;
    type: Attribute.Enumeration<['primary', 'secondary', 'white', 'text']>;
    arrow: Attribute.Boolean & Attribute.DefaultTo<false>;
    href: Attribute.String;
    newTab: Attribute.Boolean & Attribute.DefaultTo<false>;
    size: Attribute.Enumeration<['sm', 'md', 'lg']> & Attribute.DefaultTo<'md'>;
  };
}

export interface ElementsFooterColumn extends Schema.Component {
  collectionName: 'components_elements_footer_columns';
  info: {
    displayName: 'FooterColumn';
  };
  attributes: {
    title: Attribute.String;
    links: Attribute.Component<'elements.link', true>;
  };
}

export interface ElementsLink extends Schema.Component {
  collectionName: 'components_elements_links';
  info: {
    displayName: 'Link';
    icon: 'link';
    description: '';
  };
  attributes: {
    text: Attribute.String;
    href: Attribute.String;
    newTab: Attribute.Boolean & Attribute.DefaultTo<false>;
  };
}

export interface ElementsSocialMediaLink extends Schema.Component {
  collectionName: 'components_elements_social_media_links';
  info: {
    displayName: 'SocialMediaLink';
  };
  attributes: {
    type: Attribute.Enumeration<
      [
        'facebook',
        'instagram',
        'twitter',
        'youtube',
        'tiktok',
        'github',
        'linkedin'
      ]
    >;
    href: Attribute.String;
  };
}

export interface MetaFooter extends Schema.Component {
  collectionName: 'components_meta_footers';
  info: {
    displayName: 'Footer';
    description: '';
  };
  attributes: {
    logo: Attribute.Media;
    text: Attribute.Text;
    socialMediaLinks: Attribute.Component<'elements.social-media-link', true>;
    columns: Attribute.Component<'elements.footer-column', true>;
  };
}

export interface MetaMetadata extends Schema.Component {
  collectionName: 'components_meta_metadata';
  info: {
    displayName: 'Metadata';
    icon: 'medium';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.Text;
    shareImage: Attribute.Media;
  };
}

export interface MetaNavbar extends Schema.Component {
  collectionName: 'components_elements_navbars';
  info: {
    displayName: 'Navbar';
    description: '';
  };
  attributes: {
    logo: Attribute.Media;
    ctaButton: Attribute.Component<'elements.button'>;
    links: Attribute.Component<'elements.link', true>;
  };
}

export interface SectionsCausesSection extends Schema.Component {
  collectionName: 'components_sections_causes_sections';
  info: {
    displayName: 'CausesSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.RichText;
    anchor: Attribute.String;
    readAboutOrganizationsText: Attribute.String;
    causes: Attribute.Relation<
      'sections.causes-section',
      'oneToMany',
      'api::cause.cause'
    >;
  };
}

export interface SectionsCtaSection extends Schema.Component {
  collectionName: 'components_sections_cta_sections';
  info: {
    displayName: 'CtaSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.Text;
    buttons: Attribute.Component<'elements.button', true>;
  };
}

export interface SectionsHeaderSection extends Schema.Component {
  collectionName: 'components_sections_header_sections';
  info: {
    displayName: 'HeaderSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.RichText;
    breadcrumbs: Attribute.Component<'elements.breadcrumb', true>;
  };
}

export interface SectionsHeroSection extends Schema.Component {
  collectionName: 'components_sections_hero_sections';
  info: {
    displayName: 'HeroSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.Text;
    image: Attribute.Media;
    buttons: Attribute.Component<'elements.button', true>;
  };
}

export interface SectionsTextSection extends Schema.Component {
  collectionName: 'components_sections_text_sections';
  info: {
    displayName: 'TextSection';
    icon: 'bulletList';
  };
  attributes: {
    text: Attribute.RichText;
  };
}

export interface SpecialSectionsCauseOrganizationsSection
  extends Schema.Component {
  collectionName: 'components_special_sections_cause_organizations_sections';
  info: {
    displayName: 'CauseOrganizationsSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    donateButtonText: Attribute.String;
    readMoreText: Attribute.String;
    description: Attribute.RichText;
  };
}

export interface SpecialSectionsEntityTextSection extends Schema.Component {
  collectionName: 'components_special_sections_entity_text_sections';
  info: {
    displayName: 'EntityTextSection';
  };
  attributes: {
    field: Attribute.String;
  };
}

export interface SpecialSectionsOrgHeaderSection extends Schema.Component {
  collectionName: 'components_special_sections_org_header_sections';
  info: {
    displayName: 'OrgHeaderSection';
  };
  attributes: {
    breadcrumbs: Attribute.Component<'elements.breadcrumb', true>;
  };
}

export interface SpecialSectionsOrganizationHeaderSection
  extends Schema.Component {
  collectionName: 'components_special_sections_organization_header_sections';
  info: {
    displayName: 'OrganizationHeaderSection';
    description: '';
  };
  attributes: {
    hehe: Attribute.Boolean;
  };
}

export interface SpecialSectionsSpecialHeaderSection extends Schema.Component {
  collectionName: 'components_special_sections_special_header_sections';
  info: {
    displayName: 'SpecialHeaderSection';
    description: '';
  };
  attributes: {
    descriptionField: Attribute.String;
    breadcrumbs: Attribute.Component<'elements.breadcrumb', true>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'elements.breadcrumb': ElementsBreadcrumb;
      'elements.button': ElementsButton;
      'elements.footer-column': ElementsFooterColumn;
      'elements.link': ElementsLink;
      'elements.social-media-link': ElementsSocialMediaLink;
      'meta.footer': MetaFooter;
      'meta.metadata': MetaMetadata;
      'meta.navbar': MetaNavbar;
      'sections.causes-section': SectionsCausesSection;
      'sections.cta-section': SectionsCtaSection;
      'sections.header-section': SectionsHeaderSection;
      'sections.hero-section': SectionsHeroSection;
      'sections.text-section': SectionsTextSection;
      'special-sections.cause-organizations-section': SpecialSectionsCauseOrganizationsSection;
      'special-sections.entity-text-section': SpecialSectionsEntityTextSection;
      'special-sections.org-header-section': SpecialSectionsOrgHeaderSection;
      'special-sections.organization-header-section': SpecialSectionsOrganizationHeaderSection;
      'special-sections.special-header-section': SpecialSectionsSpecialHeaderSection;
    }
  }
}
