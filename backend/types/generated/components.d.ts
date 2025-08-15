import type { Schema, Attribute } from '@strapi/strapi';

export interface ElementsBankIcon extends Schema.Component {
  collectionName: 'components_elements_bank_icons';
  info: {
    displayName: 'BankIcon';
    description: '';
  };
  attributes: {
    bank: Attribute.String;
    icon: Attribute.Media;
  };
}

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
    size: Attribute.Enumeration<['text', 'sm', 'md', 'lg']> &
      Attribute.DefaultTo<'md'>;
    plausibleEvent: Attribute.String;
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

export interface ElementsPerson extends Schema.Component {
  collectionName: 'components_elements_people';
  info: {
    displayName: 'Person';
  };
  attributes: {
    name: Attribute.String;
    role: Attribute.String;
    text: Attribute.RichText;
    image: Attribute.Media;
  };
}

export interface ElementsPowerColumn extends Schema.Component {
  collectionName: 'components_elements_power_columns';
  info: {
    displayName: 'PowerColumn';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    image: Attribute.Media;
    description: Attribute.RichText;
    button: Attribute.Component<'elements.button'>;
    source: Attribute.String;
  };
}

export interface ElementsQuestion extends Schema.Component {
  collectionName: 'components_elements_questions';
  info: {
    displayName: 'Question';
    description: '';
  };
  attributes: {
    question: Attribute.String;
    answer: Attribute.RichText;
    plausibleEvent: Attribute.String;
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

export interface ElementsTeamMember extends Schema.Component {
  collectionName: 'components_elements_team_members';
  info: {
    displayName: 'TeamMember';
    description: '';
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    role: Attribute.String;
    image: Attribute.Media;
    bio: Attribute.RichText;
    email: Attribute.String;
    socialMediaLinks: Attribute.Component<'elements.social-media-link', true>;
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

export interface MetaNotFoundPage extends Schema.Component {
  collectionName: 'components_meta_not_found_pages';
  info: {
    displayName: 'NotFoundPage';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.RichText;
    buttons: Attribute.Component<'elements.button', true>;
  };
}

export interface SectionsBlogPostsSection extends Schema.Component {
  collectionName: 'components_sections_blog_posts_sections';
  info: {
    displayName: 'BlogPostsSection';
  };
  attributes: {};
}

export interface SectionsCampaignSection extends Schema.Component {
  collectionName: 'components_sections_campaign_sections';
  info: {
    displayName: 'CampaignSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    topText: Attribute.RichText;
    bottomText: Attribute.RichText;
    goals: Attribute.JSON;
    decoration: Attribute.Media;
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

export interface SectionsContactSection extends Schema.Component {
  collectionName: 'components_sections_contact_sections';
  info: {
    displayName: 'ContactSection';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.RichText;
    contactEmail: Attribute.String;
    nameLabel: Attribute.String;
    emailLabel: Attribute.String;
    messageLabel: Attribute.String;
    sendLabel: Attribute.String;
    successTitle: Attribute.String;
    successDescription: Attribute.RichText;
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
    description: Attribute.RichText;
    buttons: Attribute.Component<'elements.button', true>;
  };
}

export interface SectionsDonationSection extends Schema.Component {
  collectionName: 'components_sections_donation_sections';
  info: {
    displayName: 'DonationSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    firstNameText: Attribute.String;
    lastNameText: Attribute.String;
    emailText: Attribute.String;
    idCodeText: Attribute.String;
    idCodeDescription: Attribute.String;
    otherAmountText: Attribute.String;
    amount1: Attribute.Integer;
    amount2: Attribute.Integer;
    amount3: Attribute.Integer;
    singleDonationText: Attribute.String;
    recurringDonationText: Attribute.String;
    amountText: Attribute.String;
    nextButtonText: Attribute.String;
    donateButtonText: Attribute.String;
    termsText: Attribute.RichText;
    chooseAmountText: Attribute.String;
    otherAmountOptionText: Attribute.String;
    donationTypeText: Attribute.String;
    stepText: Attribute.String;
    backButtonText: Attribute.String;
    detailsText: Attribute.String;
    confirmText: Attribute.String;
    banks: Attribute.Component<'elements.bank-icon', true>;
    bankText: Attribute.String;
    otherBankText: Attribute.String;
    oneTimeDonationSummary: Attribute.RichText;
    recurringDonationSummary: Attribute.RichText;
    recurringDonationGuide: Attribute.RichText;
    causes: Attribute.Relation<
      'sections.donation-section',
      'oneToMany',
      'api::cause.cause'
    >;
    chooseOrganizationsText: Attribute.String;
    informationText: Attribute.String;
    lockText: Attribute.String;
    letExpertsChooseText: Attribute.String;
    tipTitle: Attribute.String;
    tipText: Attribute.RichText;
    tipCheckboxText: Attribute.String;
    donateAsCompanyText: Attribute.String;
    companyNameText: Attribute.String;
    companyCodeText: Attribute.String;
    dedicateDonationText: Attribute.String;
    dedicationNameText: Attribute.String;
    dedicationEmailText: Attribute.String;
    dedicationMessageText: Attribute.String;
    paymentMethodText: Attribute.String & Attribute.DefaultTo<'Makseviis'>;
    paymentInitiationText: Attribute.String & Attribute.DefaultTo<'Pangalink'>;
    cardPaymentsText: Attribute.String & Attribute.DefaultTo<'Kaardimakse'>;
  };
}

export interface SectionsFaqSection extends Schema.Component {
  collectionName: 'components_sections_faq_sections';
  info: {
    displayName: 'FAQSection';
  };
  attributes: {
    questions: Attribute.Component<'elements.question', true>;
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
    mobileImage: Attribute.Media;
    buttons: Attribute.Component<'elements.button', true>;
  };
}

export interface SectionsOrganizationsSection extends Schema.Component {
  collectionName: 'components_sections_organizations_sections';
  info: {
    displayName: 'OrganizationsSection';
  };
  attributes: {};
}

export interface SectionsPartnerSection extends Schema.Component {
  collectionName: 'components_sections_partner_sections';
  info: {
    displayName: 'PartnerSection';
  };
  attributes: {
    text: Attribute.RichText;
    image: Attribute.Media;
  };
}

export interface SectionsPowerSection extends Schema.Component {
  collectionName: 'components_sections_power_sections';
  info: {
    displayName: 'PowerSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    column1: Attribute.Component<'elements.power-column'>;
    column2: Attribute.Component<'elements.power-column'>;
  };
}

export interface SectionsRedirectSection extends Schema.Component {
  collectionName: 'components_sections_redirect_sections';
  info: {
    displayName: 'RedirectSection';
  };
  attributes: {
    destination: Attribute.String;
  };
}

export interface SectionsStatsSection extends Schema.Component {
  collectionName: 'components_sections_stats_sections';
  info: {
    displayName: 'StatsSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    donationAmountText: Attribute.String;
    donationAmountCurrency: Attribute.String;
    transactionFeeText: Attribute.String;
    transactionFeeValue: Attribute.String;
    operatingSinceText: Attribute.String;
    operatingSinceValue: Attribute.String;
  };
}

export interface SectionsTeamSection extends Schema.Component {
  collectionName: 'components_sections_team_sections';
  info: {
    displayName: 'TeamSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    emailCopiedText: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'Email copied to clipboard!'>;
    teamMembers: Attribute.Component<'elements.team-member', true>;
  };
}

export interface SectionsTestimonialsSection extends Schema.Component {
  collectionName: 'components_sections_testimonials_sections';
  info: {
    displayName: 'TestimonialsSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    testimonials: Attribute.Component<'elements.person', true>;
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

export interface SectionsThankYouSection extends Schema.Component {
  collectionName: 'components_sections_thank_you_sections';
  info: {
    displayName: 'ThankYouSection';
  };
  attributes: {
    title: Attribute.String;
    text1: Attribute.RichText;
    text2: Attribute.RichText;
    text3: Attribute.RichText;
  };
}

export interface SpecialSectionsBlogHeaderSection extends Schema.Component {
  collectionName: 'components_special_sections_blog_header_sections';
  info: {
    displayName: 'BlogHeaderSection';
    description: '';
  };
  attributes: {
    backButton: Attribute.Component<'elements.button'>;
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
    recommendedFundTitle: Attribute.String;
    recommendedOrganizationsTitle: Attribute.String;
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
    description: '';
  };
  attributes: {
    breadcrumbs: Attribute.Component<'elements.breadcrumb', true>;
    donateText: Attribute.String;
    websiteText: Attribute.String;
  };
}

export interface SpecialSectionsOrganizationCtaSection
  extends Schema.Component {
  collectionName: 'components_special_sections_organization_cta_sections';
  info: {
    displayName: 'OrganizationCtaSection';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.RichText;
    donateText: Attribute.String;
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
      'elements.bank-icon': ElementsBankIcon;
      'elements.breadcrumb': ElementsBreadcrumb;
      'elements.button': ElementsButton;
      'elements.footer-column': ElementsFooterColumn;
      'elements.link': ElementsLink;
      'elements.person': ElementsPerson;
      'elements.power-column': ElementsPowerColumn;
      'elements.question': ElementsQuestion;
      'elements.social-media-link': ElementsSocialMediaLink;
      'elements.team-member': ElementsTeamMember;
      'meta.footer': MetaFooter;
      'meta.metadata': MetaMetadata;
      'meta.navbar': MetaNavbar;
      'meta.not-found-page': MetaNotFoundPage;
      'sections.blog-posts-section': SectionsBlogPostsSection;
      'sections.campaign-section': SectionsCampaignSection;
      'sections.causes-section': SectionsCausesSection;
      'sections.contact-section': SectionsContactSection;
      'sections.cta-section': SectionsCtaSection;
      'sections.donation-section': SectionsDonationSection;
      'sections.faq-section': SectionsFaqSection;
      'sections.header-section': SectionsHeaderSection;
      'sections.hero-section': SectionsHeroSection;
      'sections.organizations-section': SectionsOrganizationsSection;
      'sections.partner-section': SectionsPartnerSection;
      'sections.power-section': SectionsPowerSection;
      'sections.redirect-section': SectionsRedirectSection;
      'sections.stats-section': SectionsStatsSection;
      'sections.team-section': SectionsTeamSection;
      'sections.testimonials-section': SectionsTestimonialsSection;
      'sections.text-section': SectionsTextSection;
      'sections.thank-you-section': SectionsThankYouSection;
      'special-sections.blog-header-section': SpecialSectionsBlogHeaderSection;
      'special-sections.cause-organizations-section': SpecialSectionsCauseOrganizationsSection;
      'special-sections.entity-text-section': SpecialSectionsEntityTextSection;
      'special-sections.org-header-section': SpecialSectionsOrgHeaderSection;
      'special-sections.organization-cta-section': SpecialSectionsOrganizationCtaSection;
      'special-sections.special-header-section': SpecialSectionsSpecialHeaderSection;
    }
  }
}
