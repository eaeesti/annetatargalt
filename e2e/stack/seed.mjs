// Fills a new Strapi database with the content in content.ts, through
// Strapi's Document Service, and makes the admin the tests sign in as.
// Plain JavaScript, like the backend's scripts: Strapi's types live in the
// backend, not here.
import {
  CAUSES,
  DONATION_INFO,
  ORGS,
  PAGES,
  SPECIAL_PAGES,
  TEXT,
} from "./content.ts";
import { ADMINS, TEAM_EMAIL } from "./config.ts";

/** "nextButtonText" → "Next button text" */
function humanize(name) {
  const words = name
    .replace(/([A-Z0-9]+)/g, " $1")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Text fields the filler leaves empty: links, addresses and the like, which
// would be wrong as words.
const LEFT_EMPTY =
  /^(href|anchor|plausibleEvent|slug|slugPattern|destination|homepage|internalId|collectionType|email|sourceUrl|website|mapCountry|defaultCountry|field|descriptionField)$/;

/**
 * A component's or content type's data: the fields given, and the others made
 * up from the schema. Images are left out (their file is required, and a run
 * has no image storage), and so are relations nobody named.
 */
function fill(strapi, uid, given, relate) {
  const schema = strapi.components[uid] ?? strapi.contentTypes[uid];
  if (!schema) throw new Error(`No schema for ${uid}`);
  const data = {};
  for (const [name, attribute] of Object.entries(schema.attributes)) {
    if (given && name in given) {
      data[name] = convert(strapi, attribute, given[name], relate);
      continue;
    }
    if (LEFT_EMPTY.test(name)) continue;
    if (attribute.type === "string" || attribute.type === "text") {
      data[name] = humanize(name);
    } else if (attribute.type === "richtext") {
      data[name] = `${humanize(name)}.`;
    } else if (attribute.type === "enumeration") {
      data[name] = attribute.default ?? attribute.enum[0];
    } else if (
      attribute.type === "component" &&
      !attribute.repeatable &&
      attribute.component !== "elements.image"
    ) {
      data[name] = fill(strapi, attribute.component, {}, relate);
    }
  }
  return data;
}

function convert(strapi, attribute, value, relate) {
  if (attribute.type === "component") {
    return attribute.repeatable
      ? value.map((item) => fill(strapi, attribute.component, item, relate))
      : fill(strapi, attribute.component, value, relate);
  }
  if (attribute.type === "dynamiczone") {
    return value.map(({ __component, ...fields }) => ({
      __component,
      ...fill(strapi, __component, fields, relate),
    }));
  }
  if (attribute.type === "relation") return relate(attribute.target, value);
  return value;
}

const button = (text, href, type = "primary") => ({ text, href, type });

function globalData(locale) {
  const en = locale === "en";
  return {
    title: TEXT.siteTitle,
    languageName: en ? "English" : "Eesti",
    currency: "€",
    dateLocale: en ? "en-GB" : "et-EE",
    donateLink: en ? "/en/donate" : "/anneta",
    blogSlug: "blogi",
    tipOrganization: ORGS.tip.title,
    tipOrganizationInternalId: ORGS.tip.internalId,
    externalOrganizationInternalId: ORGS.tip.internalId,
    topBannerText: "",
    metadata: { title: TEXT.siteTitle, description: "A site for the tests." },
    navbar: {
      links: en
        ? [{ text: "Donate", href: "/en/donate" }]
        : [
            { text: "Kuhu annetada", href: "/kuhu-annetada" },
            { text: "KKK", href: "/kkk" },
            { text: "Kontakt", href: "/kontakt" },
          ],
      ctaButton: button(
        en ? "Donate" : "Anneta",
        en ? "/en/donate" : "/anneta",
      ),
    },
    footer: {
      text: "Footer text for the tests.",
      columns: [
        {
          title: "Links",
          links: [
            { text: "FAQ", href: "/kkk" },
            { text: "Contact", href: "/kontakt" },
          ],
        },
      ],
      socialMediaLinks: [{ type: "github", href: "https://github.com" }],
    },
    notFoundPage: {
      title: TEXT.notFoundTitle,
      description: "Check the address.",
      buttons: [button("Back to the front page", en ? "/en" : "/")],
    },
  };
}

function emailConfigData(locale) {
  const tag = locale === "en" ? " (en)" : "";
  return {
    confirmationSubject: TEXT.confirmationSubject + tag,
    confirmationText:
      "Dear <%= firstName %>, you gave <%= amount %> <%= currency %>.\n<%= summary %>",
    confirmationHtml:
      "<p>Dear <%= firstNameHtml %>, you gave <%= amount %> <%= currency %>.</p>",
    confirmationReplyTo: "hello@e2e.test",
    contactFormSubmissionSubject: `${TEXT.contactSubject}: <%= name %>`,
    contactFormSubmissionText:
      "From <%= name %> (<%= email %>):\n<%= message %>",
    contactFormSubmissionHtml:
      "<p>From <%= name %> (<%= email %>):</p><p><%= message %></p>",
    contactFormSubmissionRecipients: TEAM_EMAIL,
    dedicationSubject: TEXT.dedicationSubject + tag,
    dedicationText: "Someone gave in your name.",
    dedicationHtml: "<p>Someone gave in your name.</p>",
    footerText: "The E2E platform",
    preferencesLinkText: "Choose your emails",
  };
}

async function seedAdmins(strapi) {
  const role = await strapi.service("admin::role").getSuperAdmin();
  for (const admin of Object.values(ADMINS)) {
    await strapi.service("admin::user").create({
      ...admin,
      isActive: true,
      roles: [role.id],
    });
  }
}

export async function seed(strapi) {
  await seedAdmins(strapi);

  const docs = (uid) => strapi.documents(uid);
  const orgIds = {};
  const causeIds = {};

  // Relations are named in content.ts by their keys.
  const relate = (target, keys) => {
    const ids = target === "api::cause.cause" ? causeIds : orgIds;
    return (Array.isArray(keys) ? keys : [keys]).map((key) => {
      if (!ids[key]) throw new Error(`Nothing called ${key} for ${target}`);
      return ids[key];
    });
  };

  for (const [key, org] of Object.entries(ORGS)) {
    const data = {
      ...org,
      fund: key === "fund" || key === "climateFund",
      active: key !== "dormant",
      homepage: "https://example.org",
      shortDescription: `${org.title} in one line.`,
      introduction: `${org.title} introduction.`,
      content: `${org.title} does good work.`,
      metadata: { title: org.title, description: `About ${org.title}` },
    };
    const created = await docs("api::organization.organization").create({
      data,
      locale: "et",
      status: "published",
    });
    orgIds[key] = created.documentId;
    await docs("api::organization.organization").update({
      documentId: created.documentId,
      locale: "en",
      data: { ...data, title: `${org.title} (en)` },
      status: "published",
    });
  }

  for (const [key, cause] of Object.entries(CAUSES)) {
    const data = {
      title: cause.title,
      slug: cause.slug,
      active: true,
      shortDescription: `${cause.title} in one line.`,
      introduction: `${cause.title} introduction.`,
      content: `${cause.title} content.`,
      metadata: { title: cause.title, description: `About ${cause.title}` },
      organizations: relate("api::organization.organization", cause.orgs),
    };
    const created = await docs("api::cause.cause").create({
      data,
      locale: "et",
      status: "published",
    });
    causeIds[key] = created.documentId;
    await docs("api::cause.cause").update({
      documentId: created.documentId,
      locale: "en",
      data: { ...data, title: cause.enTitle, slug: cause.enSlug },
      status: "published",
    });
  }

  for (const locale of ["et", "en"]) {
    const uid = "api::global.global";
    const data = fill(strapi, uid, globalData(locale), relate);
    if (locale === "et") await docs(uid).create({ data, locale });
    else {
      const existing = await docs(uid).findFirst({ locale: "et" });
      await docs(uid).update({ documentId: existing.documentId, data, locale });
    }
  }

  for (const locale of ["et", "en"]) {
    for (const [uid, data] of [
      [
        "api::donation-info.donation-info",
        {
          ...DONATION_INFO,
          returnPath: locale === "en" ? "en/thank-you" : "aitah",
        },
      ],
      ["api::email-config.email-config", emailConfigData(locale)],
    ]) {
      const filled = fill(strapi, uid, data, relate);
      const existing = await docs(uid).findFirst({ locale: "et" });
      if (!existing) await docs(uid).create({ data: filled, locale });
      else {
        await docs(uid).update({
          documentId: existing.documentId,
          data: filled,
          locale,
        });
      }
    }
  }

  for (const page of PAGES) {
    const uid = "api::page.page";
    const data = fill(
      strapi,
      uid,
      {
        name: page.name,
        slug: page.slug,
        sections: page.sections,
        metadata: { title: page.name, description: `${page.name} page` },
      },
      relate,
    );
    const created = await docs(uid).create({
      data,
      locale: "et",
      status: "published",
    });
    if (page.en) {
      await docs(uid).update({
        documentId: created.documentId,
        locale: "en",
        data: fill(
          strapi,
          uid,
          {
            ...page.en,
            metadata: { title: page.en.name, description: "English page" },
          },
          relate,
        ),
        status: "published",
      });
    }
  }

  for (const special of SPECIAL_PAGES) {
    const uid = "api::special-page.special-page";
    const data = {
      name: special.name,
      slugPattern: special.slugPattern,
      collectionType: special.collectionType,
      sections: special.sections,
    };
    const created = await docs(uid).create({
      data: fill(strapi, uid, data, relate),
      locale: "et",
    });
    if (special.enSlugPattern) {
      await docs(uid).update({
        documentId: created.documentId,
        locale: "en",
        data: fill(
          strapi,
          uid,
          { ...data, slugPattern: special.enSlugPattern },
          relate,
        ),
      });
    }
  }

  const author = await docs("api::blog-author.blog-author").create({
    data: fill(strapi, "api::blog-author.blog-author", {}, relate),
    locale: "et",
    status: "published",
  });
  await docs("api::blog-post.blog-post").create({
    data: fill(
      strapi,
      "api::blog-post.blog-post",
      {
        title: TEXT.blogPostTitle,
        slug: "first-post",
        date: "2026-01-15",
        preview: "The first post's preview.",
        content: "The first post's body.",
        author: author.documentId,
        metadata: { title: TEXT.blogPostTitle, description: "A post" },
      },
      () => author.documentId,
    ),
    locale: "et",
    status: "published",
  });
}
