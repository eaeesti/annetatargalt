/**
 * The content the seed puts in Strapi, and the tests look for. Every name is
 * made up. A field left out of a section is filled in by the seed from the
 * schema, with the field's name in words ("nextButtonText" becomes "Next
 * button text"), so the tests can find it by that.
 */

export const ORGS = {
  fund: { internalId: "E2E_FUND", title: "Example Fund", slug: "example-fund" },
  alpha: { internalId: "E2E_ALPHA", title: "Alpha Aid", slug: "alpha-aid" },
  beta: { internalId: "E2E_BETA", title: "Beta Health", slug: "beta-health" },
  climateFund: {
    internalId: "E2E_CLIMATE_FUND",
    title: "Climate Fund",
    slug: "climate-fund",
  },
  gamma: { internalId: "E2E_GAMMA", title: "Gamma Trees", slug: "gamma-trees" },
  dormant: {
    internalId: "E2E_DORMANT",
    title: "Dormant Org",
    slug: "dormant-org",
  },
  tip: { internalId: "E2E_TIP", title: "Platform tip", slug: "platform-tip" },
};

export const CAUSES = {
  health: {
    title: "Health and poverty",
    slug: "kuhu-annetada/tervis",
    enTitle: "Health and poverty (en)",
    enSlug: "where-to-donate/health",
    orgs: ["fund", "alpha", "beta", "dormant"] as const,
  },
  climate: {
    title: "Climate",
    slug: "kuhu-annetada/kliima",
    enTitle: "Climate (en)",
    enSlug: "where-to-donate/climate",
    orgs: ["climateFund", "gamma"] as const,
  },
};

export const DONATION_INFO = {
  iban: "EE471000001020145685",
  recipient: "E2E Platform MTÜ",
  merchantReferencePrefix: "E2E",
  externalMerchantReferencePrefix: "E2EX",
  recurringPaymentComment: "Monthly donation",
  externalRecurringPaymentComment: "Monthly donation (external)",
};

/** The texts the tests read. */
export const TEXT = {
  siteTitle: "E2E Giving",
  heroTitle: "Give where it helps most",
  enHeroTitle: "Give where it helps most (en)",
  donateTitle: "Make a donation",
  enDonateTitle: "Make a donation (en)",
  thankYouTitle: "Thank you, <%= firstName %>!",
  contactTitle: "Write to us",
  contactSuccess: "Message received",
  faqTitle: "Questions and answers",
  faqQuestion: "Is my donation tax deductible?",
  faqAnswer: "Yes, within the limits the law sets.",
  whereTitle: "Where to donate",
  notFoundTitle: "This page doesn't exist",
  preferencesTitle: "Your email settings",
  confirmationSubject: "Thank you for your donation",
  dedicationSubject: "A donation in your name",
  contactSubject: "New message from the site",
  foreignTitle: "Donate from abroad",
  blogTitle: "News",
  blogPostTitle: "A first post",
  textPageText: "Plain text page body.",
  calculatorTitle: "How rich are you?",
};

/** A section: its component and the fields that matter. */
export type Section = { __component: string } & Record<string, unknown>;

export interface PageContent {
  name: string;
  slug: string;
  sections: Section[];
  /** The same page in English, if it has one. */
  en?: { name: string; slug: string; sections: Section[] };
}

const button = (text: string, href: string, type = "primary") => ({
  text,
  href,
  type,
});

export const PAGES: PageContent[] = [
  {
    name: "Home",
    slug: "/",
    sections: [
      {
        __component: "sections.hero-section",
        title: TEXT.heroTitle,
        subtitle: "Placeholder subtitle for the tests.",
        buttons: [button("Donate now", "/anneta")],
      },
      {
        __component: "sections.stats-section",
        title: "Our numbers",
        donationAmountCurrency: "€",
        transactionFeeValue: "0%",
        operatingSinceValue: "2020",
      },
      {
        __component: "sections.causes-section",
        title: "Causes we support",
        causes: ["health", "climate"],
      },
      {
        __component: "sections.power-section",
        title: "The power of giving",
        column1: { title: "Column one", description: "First column." },
        column2: { title: "Column two", description: "Second column." },
      },
      {
        __component: "sections.testimonials-section",
        title: "What donors say",
        testimonials: [{ name: "Tess Donor", role: "Donor", text: "Good." }],
      },
      {
        __component: "sections.cta-section",
        title: "Ready to give?",
        buttons: [button("Give today", "/anneta")],
      },
    ],
    en: {
      name: "Home",
      slug: "/",
      sections: [
        {
          __component: "sections.hero-section",
          title: TEXT.enHeroTitle,
          buttons: [button("Donate now (en)", "/en/donate")],
        },
      ],
    },
  },
  {
    name: "Donate",
    slug: "anneta",
    sections: [
      {
        __component: "sections.donation-section",
        title: TEXT.donateTitle,
        amount1: 10,
        amount2: 30,
        amount3: 60,
        causes: ["health", "climate"],
        tipTitle: "Support the platform",
        oneTimeDonationSummary: "Your one-off donation:",
        recurringDonationSummary: "Your monthly donation:",
        recurringDonationGuide: "Set up a standing order of <%= amount %>.",
        banks: [{ bank: "swedbank" }, { bank: "seb" }, { bank: "lhv" }],
      },
    ],
    en: {
      name: "Donate",
      slug: "donate",
      sections: [
        {
          __component: "sections.donation-section",
          title: TEXT.enDonateTitle,
          amount1: 10,
          amount2: 30,
          amount3: 60,
          causes: ["health", "climate"],
          banks: [{ bank: "swedbank" }],
        },
      ],
    },
  },
  {
    name: "Thank you",
    slug: "aitah",
    sections: [
      {
        __component: "sections.thank-you-section",
        title: TEXT.thankYouTitle,
        text1: "You gave <%= amount %>.",
        text2: "Second paragraph.",
        text3: "Third paragraph.",
      },
    ],
    en: {
      name: "Thank you",
      slug: "thank-you",
      sections: [
        {
          __component: "sections.thank-you-section",
          title: "Thank you (en), <%= firstName %>!",
          text1: "You gave <%= amount %>.",
        },
      ],
    },
  },
  {
    name: "Contact",
    slug: "kontakt",
    sections: [
      {
        __component: "sections.contact-section",
        title: TEXT.contactTitle,
        contactEmail: "hello@e2e.test",
        successTitle: TEXT.contactSuccess,
      },
      {
        __component: "sections.team-section",
        title: "Our team",
        emailCopiedText: "Email copied",
        teamMembers: [
          { name: "Tiina Team", role: "Coordinator", email: "tiina@e2e.test" },
        ],
      },
    ],
  },
  {
    name: "FAQ",
    slug: "kkk",
    sections: [
      { __component: "sections.header-section", title: TEXT.faqTitle },
      {
        __component: "sections.faq-section",
        questions: [
          { question: TEXT.faqQuestion, answer: TEXT.faqAnswer },
          { question: "How are the organizations chosen?", answer: "Care." },
        ],
      },
    ],
  },
  {
    name: "Where to donate",
    slug: "kuhu-annetada",
    sections: [
      { __component: "sections.header-section", title: TEXT.whereTitle },
      {
        __component: "sections.causes-section",
        title: "All causes",
        causes: ["health", "climate"],
      },
      { __component: "sections.organizations-section" },
    ],
  },
  {
    name: "Email settings",
    slug: "teavitused",
    sections: [
      {
        __component: "sections.email-preferences-section",
        title: TEXT.preferencesTitle,
        text: "Settings for <%= email %>.",
      },
    ],
  },
  {
    name: "Donate from abroad",
    slug: "annetus-valismaalt",
    sections: [
      {
        __component: "sections.foreign-donation-section",
        title: TEXT.foreignTitle,
        description: "Card payments only.",
        termsText: "I agree with the terms.",
      },
    ],
  },
  {
    name: "Blog",
    slug: "blogi",
    sections: [
      { __component: "sections.header-section", title: TEXT.blogTitle },
      { __component: "sections.blog-posts-section" },
    ],
  },
  {
    name: "Text",
    slug: "tekst",
    sections: [
      {
        __component: "sections.text-section",
        text: `## Text page\n\n${TEXT.textPageText}\n\n- one\n- two`,
      },
    ],
  },
  {
    name: "Old page",
    slug: "vana-leht",
    sections: [
      { __component: "sections.redirect-section", destination: "/kkk" },
    ],
  },
  {
    name: "Calculator",
    slug: "kui-rikas-sa-oled",
    sections: [
      { __component: "sections.header-section", title: TEXT.calculatorTitle },
      {
        __component: "sections.income-calculator-section",
        causes: ["health"],
        summaryText: "Your income is <%= income %>.",
      },
    ],
  },
];

/** The pages for causes, organizations and blog posts, by their slugs. */
export const SPECIAL_PAGES = [
  {
    name: "Cause",
    slugPattern: "^(kuhu-annetada/[^/]+)$",
    enSlugPattern: "^(where-to-donate/[^/]+)$",
    collectionType: "causes",
    sections: [
      {
        __component: "special-sections.special-header-section",
        descriptionField: "introduction",
      },
      {
        __component: "special-sections.entity-text-section",
        field: "content",
      },
      { __component: "special-sections.cause-organizations-section" },
    ],
  },
  {
    name: "Organization",
    slugPattern: "^kuhu-annetada/[^/]+/([^/]+)$",
    enSlugPattern: "^where-to-donate/[^/]+/([^/]+)$",
    collectionType: "organizations",
    sections: [
      { __component: "special-sections.org-header-section" },
      {
        __component: "special-sections.entity-text-section",
        field: "content",
      },
      {
        __component: "special-sections.organization-cta-section",
        title: "Support this organization",
        donateText: "Donate to <%= title %>",
      },
    ],
  },
  {
    name: "Blog post",
    slugPattern: "^blogi/([^/]+)$",
    collectionType: "blog-posts",
    sections: [
      {
        __component: "special-sections.blog-header-section",
        backButton: button("Back", "/blogi", "text"),
      },
      {
        __component: "special-sections.entity-text-section",
        field: "content",
      },
    ],
  },
];
