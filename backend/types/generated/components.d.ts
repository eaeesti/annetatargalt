import type { Schema, Struct } from '@strapi/strapi';

export interface ElementsBankIcon extends Struct.ComponentSchema {
  collectionName: 'components_elements_bank_icons';
  info: {
    description: '';
    displayName: 'BankIcon';
  };
  attributes: {
    bank: Schema.Attribute.String;
    icon: Schema.Attribute.Media<'images'>;
  };
}

export interface ElementsBreadcrumb extends Struct.ComponentSchema {
  collectionName: 'components_elements_breadcrumbs';
  info: {
    description: '';
    displayName: 'Breadcrumb';
  };
  attributes: {
    href: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface ElementsButton extends Struct.ComponentSchema {
  collectionName: 'components_elements_buttons';
  info: {
    description: '';
    displayName: 'Button';
  };
  attributes: {
    arrow: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    href: Schema.Attribute.String;
    newTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    plausibleEvent: Schema.Attribute.String;
    size: Schema.Attribute.Enumeration<['text', 'sm', 'md', 'lg']> &
      Schema.Attribute.DefaultTo<'md'>;
    text: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<
      ['primary', 'secondary', 'white', 'text']
    >;
  };
}

export interface ElementsFooterColumn extends Struct.ComponentSchema {
  collectionName: 'components_elements_footer_columns';
  info: {
    displayName: 'FooterColumn';
  };
  attributes: {
    links: Schema.Attribute.Component<'elements.link', true>;
    title: Schema.Attribute.String;
  };
}

export interface ElementsLink extends Struct.ComponentSchema {
  collectionName: 'components_elements_links';
  info: {
    description: '';
    displayName: 'Link';
    icon: 'link';
  };
  attributes: {
    href: Schema.Attribute.String;
    newTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    text: Schema.Attribute.String;
  };
}

export interface ElementsPerson extends Struct.ComponentSchema {
  collectionName: 'components_elements_people';
  info: {
    displayName: 'Person';
  };
  attributes: {
    image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    name: Schema.Attribute.String;
    role: Schema.Attribute.String;
    text: Schema.Attribute.RichText;
  };
}

export interface ElementsPowerColumn extends Struct.ComponentSchema {
  collectionName: 'components_elements_power_columns';
  info: {
    description: '';
    displayName: 'PowerColumn';
  };
  attributes: {
    button: Schema.Attribute.Component<'elements.button', false>;
    description: Schema.Attribute.RichText;
    image: Schema.Attribute.Media<'images'>;
    source: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface ElementsQuestion extends Struct.ComponentSchema {
  collectionName: 'components_elements_questions';
  info: {
    description: '';
    displayName: 'Question';
  };
  attributes: {
    answer: Schema.Attribute.RichText;
    plausibleEvent: Schema.Attribute.String;
    question: Schema.Attribute.String;
  };
}

export interface ElementsSocialMediaLink extends Struct.ComponentSchema {
  collectionName: 'components_elements_social_media_links';
  info: {
    displayName: 'SocialMediaLink';
  };
  attributes: {
    href: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<
      [
        'facebook',
        'instagram',
        'twitter',
        'youtube',
        'tiktok',
        'github',
        'linkedin',
      ]
    >;
  };
}

export interface ElementsTeamMember extends Struct.ComponentSchema {
  collectionName: 'components_elements_team_members';
  info: {
    description: '';
    displayName: 'TeamMember';
  };
  attributes: {
    bio: Schema.Attribute.RichText;
    email: Schema.Attribute.String;
    image: Schema.Attribute.Media<'images'>;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    role: Schema.Attribute.String;
    socialMediaLinks: Schema.Attribute.Component<
      'elements.social-media-link',
      true
    >;
  };
}

export interface MetaFooter extends Struct.ComponentSchema {
  collectionName: 'components_meta_footers';
  info: {
    description: '';
    displayName: 'Footer';
  };
  attributes: {
    columns: Schema.Attribute.Component<'elements.footer-column', true>;
    logo: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    socialMediaLinks: Schema.Attribute.Component<
      'elements.social-media-link',
      true
    >;
    text: Schema.Attribute.Text;
  };
}

export interface MetaMetadata extends Struct.ComponentSchema {
  collectionName: 'components_meta_metadata';
  info: {
    displayName: 'Metadata';
    icon: 'medium';
  };
  attributes: {
    description: Schema.Attribute.Text;
    shareImage: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String;
  };
}

export interface MetaNavbar extends Struct.ComponentSchema {
  collectionName: 'components_elements_navbars';
  info: {
    description: '';
    displayName: 'Navbar';
  };
  attributes: {
    ctaButton: Schema.Attribute.Component<'elements.button', false>;
    links: Schema.Attribute.Component<'elements.link', true>;
    logo: Schema.Attribute.Media<'images'>;
  };
}

export interface MetaNotFoundPage extends Struct.ComponentSchema {
  collectionName: 'components_meta_not_found_pages';
  info: {
    displayName: 'NotFoundPage';
  };
  attributes: {
    buttons: Schema.Attribute.Component<'elements.button', true>;
    description: Schema.Attribute.RichText;
    title: Schema.Attribute.String;
  };
}

export interface SectionsBlogPostsSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_blog_posts_sections';
  info: {
    displayName: 'BlogPostsSection';
  };
  attributes: {};
}

export interface SectionsCampaignSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_campaign_sections';
  info: {
    description: '';
    displayName: 'CampaignSection';
  };
  attributes: {
    bottomText: Schema.Attribute.RichText &
      Schema.Attribute.DefaultTo<'**Sinu annetusel on topeltm\u00F5ju!** Suurannetajad Martin ja Mari-Liis Villig kahekordistavad k\u00F5ik annetused 10 000 \u20AC ulatuses.'>;
    countdownText: Schema.Attribute.RichText &
      Schema.Attribute.DefaultTo<'Kampaania l\u00F5puni on j\u00E4\u00E4nud **<%= days %>** p\u00E4eva, **<%= hours %>** tundi, **<%= minutes %>** minutit ja **<%= seconds %>** sekundit.'>;
    ctaButtonHref: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'/anneta'>;
    ctaButtonText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Anneta kahekordse m\u00F5juga'>;
    decoration: Schema.Attribute.Media<'images'>;
    endDate: Schema.Attribute.DateTime &
      Schema.Attribute.DefaultTo<'2026-11-30T22:00:00.000Z'>;
    goals: Schema.Attribute.JSON;
    title: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'J\u00F5ulukampaania 2025'>;
    topText: Schema.Attribute.RichText &
      Schema.Attribute.DefaultTo<'**<%= amount %>\u20AC** on annetatud **<%= goal %>\u20AC** eesm\u00E4rgist.  Eesm\u00E4rgi saavutamiseks on puudu vaid **<%= remainingUntilGoal %>\u20AC**!'>;
  };
}

export interface SectionsCausesSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_causes_sections';
  info: {
    description: '';
    displayName: 'CausesSection';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    causes: Schema.Attribute.Relation<'oneToMany', 'api::cause.cause'>;
    description: Schema.Attribute.RichText;
    readAboutOrganizationsText: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SectionsContactSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_contact_sections';
  info: {
    displayName: 'ContactSection';
  };
  attributes: {
    contactEmail: Schema.Attribute.String;
    description: Schema.Attribute.RichText;
    emailLabel: Schema.Attribute.String;
    messageLabel: Schema.Attribute.String;
    nameLabel: Schema.Attribute.String;
    sendLabel: Schema.Attribute.String;
    successDescription: Schema.Attribute.RichText;
    successTitle: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SectionsCtaSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_cta_sections';
  info: {
    description: '';
    displayName: 'CtaSection';
  };
  attributes: {
    buttons: Schema.Attribute.Component<'elements.button', true>;
    description: Schema.Attribute.RichText;
    title: Schema.Attribute.String;
  };
}

export interface SectionsDonationSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_donation_sections';
  info: {
    description: '';
    displayName: 'DonationSection';
  };
  attributes: {
    amount1: Schema.Attribute.Integer;
    amount2: Schema.Attribute.Integer;
    amount3: Schema.Attribute.Integer;
    amountText: Schema.Attribute.String;
    backButtonText: Schema.Attribute.String;
    banks: Schema.Attribute.Component<'elements.bank-icon', true>;
    bankText: Schema.Attribute.String;
    cardPaymentsText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Kaardimakse'>;
    causes: Schema.Attribute.Relation<'oneToMany', 'api::cause.cause'>;
    chooseAmountText: Schema.Attribute.String;
    chooseOrganizationsText: Schema.Attribute.String;
    companyCodeText: Schema.Attribute.String;
    companyNameText: Schema.Attribute.String;
    confirmText: Schema.Attribute.String;
    dedicateDonationText: Schema.Attribute.String;
    dedicationEmailText: Schema.Attribute.String;
    dedicationMessageText: Schema.Attribute.String;
    dedicationNameText: Schema.Attribute.String;
    detailsText: Schema.Attribute.String;
    donateAsCompanyText: Schema.Attribute.String;
    donateButtonText: Schema.Attribute.String;
    donationTypeText: Schema.Attribute.String;
    emailText: Schema.Attribute.String;
    firstNameText: Schema.Attribute.String;
    idCodeDescription: Schema.Attribute.String;
    idCodeText: Schema.Attribute.String;
    informationText: Schema.Attribute.String;
    lastNameText: Schema.Attribute.String;
    letExpertsChooseText: Schema.Attribute.String;
    lockText: Schema.Attribute.String;
    nextButtonText: Schema.Attribute.String;
    oneTimeDonationSummary: Schema.Attribute.RichText;
    otherAmountOptionText: Schema.Attribute.String;
    otherAmountText: Schema.Attribute.String;
    otherBankText: Schema.Attribute.String;
    paymentInitiationText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Pangalink'>;
    paymentMethodText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Makseviis'>;
    recurringDonationGuide: Schema.Attribute.RichText;
    recurringDonationSummary: Schema.Attribute.RichText;
    recurringDonationText: Schema.Attribute.String;
    singleDonationText: Schema.Attribute.String;
    stepText: Schema.Attribute.String;
    termsText: Schema.Attribute.RichText;
    tipCheckboxText: Schema.Attribute.String;
    tipText: Schema.Attribute.RichText;
    tipTitle: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SectionsFaqSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_faq_sections';
  info: {
    displayName: 'FAQSection';
  };
  attributes: {
    questions: Schema.Attribute.Component<'elements.question', true>;
  };
}

export interface SectionsForeignDonationSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_foreign_donation_sections';
  info: {
    displayName: 'ForeignDonationSection';
  };
  attributes: {
    amount1: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<20>;
    amount2: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<50>;
    amount3: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<100>;
    amountText: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Amount'>;
    description: Schema.Attribute.RichText &
      Schema.Attribute.DefaultTo<'On this page you can donate directly to Anneta Targalt using a card payment.\n\nThank you for supporting our platform!'>;
    donateButtonText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Donate'>;
    emailText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Email address'>;
    firstNameText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'First name'>;
    lastNameText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Last name'>;
    nextButtonText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Next'>;
    otherAmountOptionText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Other'>;
    otherAmountText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Other amount'>;
    termsText: Schema.Attribute.RichText &
      Schema.Attribute.DefaultTo<'I agree with the [terms and conditions](/annetustingimused).'>;
    title: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Donate'>;
  };
}

export interface SectionsHeaderSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_header_sections';
  info: {
    description: '';
    displayName: 'HeaderSection';
  };
  attributes: {
    breadcrumbs: Schema.Attribute.Component<'elements.breadcrumb', true>;
    subtitle: Schema.Attribute.RichText;
    title: Schema.Attribute.String;
  };
}

export interface SectionsHeroSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_hero_sections';
  info: {
    description: '';
    displayName: 'HeroSection';
  };
  attributes: {
    buttons: Schema.Attribute.Component<'elements.button', true>;
    image: Schema.Attribute.Media<'images'>;
    mobileImage: Schema.Attribute.Media<'images'>;
    subtitle: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SectionsOrganizationsSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_organizations_sections';
  info: {
    displayName: 'OrganizationsSection';
  };
  attributes: {};
}

export interface SectionsPartnerSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_partner_sections';
  info: {
    displayName: 'PartnerSection';
  };
  attributes: {
    image: Schema.Attribute.Media<'images'>;
    text: Schema.Attribute.RichText;
  };
}

export interface SectionsPowerSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_power_sections';
  info: {
    description: '';
    displayName: 'PowerSection';
  };
  attributes: {
    column1: Schema.Attribute.Component<'elements.power-column', false>;
    column2: Schema.Attribute.Component<'elements.power-column', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsRedirectSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_redirect_sections';
  info: {
    displayName: 'RedirectSection';
  };
  attributes: {
    destination: Schema.Attribute.String;
  };
}

export interface SectionsStatsSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_stats_sections';
  info: {
    description: '';
    displayName: 'StatsSection';
  };
  attributes: {
    donationAmountCurrency: Schema.Attribute.String;
    donationAmountText: Schema.Attribute.String;
    operatingSinceText: Schema.Attribute.String;
    operatingSinceValue: Schema.Attribute.String;
    title: Schema.Attribute.String;
    transactionFeeText: Schema.Attribute.String;
    transactionFeeValue: Schema.Attribute.String;
  };
}

export interface SectionsTeamSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_team_sections';
  info: {
    description: '';
    displayName: 'TeamSection';
  };
  attributes: {
    emailCopiedText: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Email copied to clipboard!'>;
    teamMembers: Schema.Attribute.Component<'elements.team-member', true>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsTestimonialsSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_testimonials_sections';
  info: {
    description: '';
    displayName: 'TestimonialsSection';
  };
  attributes: {
    testimonials: Schema.Attribute.Component<'elements.person', true>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsTextSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_text_sections';
  info: {
    displayName: 'TextSection';
    icon: 'bulletList';
  };
  attributes: {
    text: Schema.Attribute.RichText;
  };
}

export interface SectionsThankYouSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_thank_you_sections';
  info: {
    displayName: 'ThankYouSection';
  };
  attributes: {
    text1: Schema.Attribute.RichText;
    text2: Schema.Attribute.RichText;
    text3: Schema.Attribute.RichText;
    title: Schema.Attribute.String;
  };
}

export interface SpecialSectionsBlogHeaderSection
  extends Struct.ComponentSchema {
  collectionName: 'components_special_sections_blog_header_sections';
  info: {
    description: '';
    displayName: 'BlogHeaderSection';
  };
  attributes: {
    backButton: Schema.Attribute.Component<'elements.button', false>;
  };
}

export interface SpecialSectionsCauseOrganizationsSection
  extends Struct.ComponentSchema {
  collectionName: 'components_special_sections_cause_organizations_sections';
  info: {
    description: '';
    displayName: 'CauseOrganizationsSection';
  };
  attributes: {
    recommendedFundTitle: Schema.Attribute.String;
    recommendedOrganizationsTitle: Schema.Attribute.String;
  };
}

export interface SpecialSectionsEntityTextSection
  extends Struct.ComponentSchema {
  collectionName: 'components_special_sections_entity_text_sections';
  info: {
    displayName: 'EntityTextSection';
  };
  attributes: {
    field: Schema.Attribute.String;
  };
}

export interface SpecialSectionsOrgHeaderSection
  extends Struct.ComponentSchema {
  collectionName: 'components_special_sections_org_header_sections';
  info: {
    description: '';
    displayName: 'OrgHeaderSection';
  };
  attributes: {
    breadcrumbs: Schema.Attribute.Component<'elements.breadcrumb', true>;
    donateText: Schema.Attribute.String;
    websiteText: Schema.Attribute.String;
  };
}

export interface SpecialSectionsOrganizationCtaSection
  extends Struct.ComponentSchema {
  collectionName: 'components_special_sections_organization_cta_sections';
  info: {
    displayName: 'OrganizationCtaSection';
  };
  attributes: {
    description: Schema.Attribute.RichText;
    donateText: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SpecialSectionsSpecialHeaderSection
  extends Struct.ComponentSchema {
  collectionName: 'components_special_sections_special_header_sections';
  info: {
    description: '';
    displayName: 'SpecialHeaderSection';
  };
  attributes: {
    breadcrumbs: Schema.Attribute.Component<'elements.breadcrumb', true>;
    descriptionField: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
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
      'sections.foreign-donation-section': SectionsForeignDonationSection;
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
