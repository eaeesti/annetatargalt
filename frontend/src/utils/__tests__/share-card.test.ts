import { describe, expect, it } from "vitest";
import type {
  StrapiHeroSection,
  StrapiImage,
  StrapiMetadata,
} from "@/types/generated/strapi";
import {
  cardLogoUrl,
  cardPhotoUrl,
  pageOfCard,
  shareCard,
  shareCardImage,
  shareCardPath,
  shorten,
} from "../share-card";

const CLOUDINARY = "https://res.cloudinary.com/example/image/upload";

function image(url: string): StrapiImage {
  return {
    id: 1,
    alt: null,
    decorative: true,
    file: {
      id: 1,
      documentId: "f",
      url,
      alternativeText: null,
      width: 1920,
      height: 1080,
      formats: null,
      name: null,
      mime: null,
      size: null,
    },
  };
}

function metadata(fields: Partial<StrapiMetadata>): StrapiMetadata {
  return {
    id: 1,
    title: null,
    description: null,
    shareImage: null,
    unlisted: null,
    ...fields,
  };
}

const global = { title: "Site" };

const hero: StrapiHeroSection = {
  id: 1,
  __component: "sections.hero-section",
  title: "Give well",
  subtitle: "Where a euro does the most",
  image: image(`${CLOUDINARY}/v1/hero.webp`),
  imagePosition: "upper",
  buttons: [],
};

describe("shareCard", () => {
  it("draws a page that opens with a hero as the hero is", () => {
    expect(
      shareCard({ name: "Home", sections: [hero] }, undefined, global),
    ).toEqual({
      site: "Site",
      title: "Give well",
      subtitle: "Where a euro does the most",
      logo: null,
      photo: { url: `${CLOUDINARY}/v1/hero.webp`, focus: 0.25 },
    });
    // The hero's own default crop
    expect(
      shareCard(
        { name: "Home", sections: [{ ...hero, imagePosition: null }] },
        undefined,
        global,
      ).photo?.focus,
    ).toBe(0.75);
  });

  it("puts a header's title on a plain card", () => {
    expect(
      shareCard(
        {
          name: "FAQ page",
          sections: [
            {
              id: 2,
              __component: "sections.header-section",
              title: "Questions",
              subtitle: null,
              breadcrumbs: [],
            },
          ],
        },
        undefined,
        global,
      ),
    ).toEqual({
      site: "Site",
      title: "Questions",
      subtitle: null,
      logo: null,
      photo: null,
    });
  });

  it("falls back to the page's title, then its name", () => {
    expect(
      shareCard(
        { name: "Name", metadata: metadata({ title: "Title" }), sections: [] },
        undefined,
        global,
      ).title,
    ).toBe("Title");
    expect(
      shareCard({ name: "Name", sections: [] }, undefined, global).title,
    ).toBe("Name");
  });

  it("draws a cause or post with its own picture, and is plain without any", () => {
    const special = { name: "Cause page", sections: [] };
    expect(
      shareCard(
        special,
        {
          title: "Climate",
          metadata: null,
          image: image(`${CLOUDINARY}/v1/c.jpg`),
        },
        global,
      ),
    ).toEqual({
      site: "Site",
      title: "Climate",
      subtitle: null,
      logo: null,
      photo: { url: `${CLOUDINARY}/v1/c.jpg`, focus: 0.5 },
    });
    expect(
      shareCard(special, { title: "A charity", metadata: null }, global).photo,
    ).toBeNull();
  });
});

describe("an organization's card", () => {
  it("carries its logo, on a plain card", () => {
    expect(
      shareCard(
        { name: "Organization page", sections: [] },
        {
          title: "A charity",
          metadata: null,
          logo: image(`${CLOUDINARY}/v1/logo.svg`),
        },
        global,
      ),
    ).toEqual({
      site: "Site",
      title: "A charity",
      subtitle: null,
      logo: `${CLOUDINARY}/v1/logo.svg`,
      photo: null,
    });
  });
});

describe("the card's address", () => {
  it("names the page and its language", () => {
    expect(shareCardPath("/", "et")).toBe("/og/et");
    expect(shareCardPath("kliima/fond", "en")).toBe("/og/en/kliima/fond");
    expect(pageOfCard(undefined)).toBe("/");
    expect(pageOfCard(["kliima", "fond"])).toBe("kliima/fond");
  });

  it("changes when what's on the card changes", () => {
    const card = {
      site: "Site",
      title: "A",
      subtitle: null,
      logo: null,
      photo: null,
    };
    const first = shareCardImage("/og/et", card);
    expect(first).toMatchObject({ width: 1200, height: 630, alt: "A" });
    expect(first.url).toMatch(/^\/og\/et\?v=\w+$/);
    expect(shareCardImage("/og/et", card).url).toBe(first.url);
    expect(shareCardImage("/og/et", { ...card, title: "B" }).url).not.toBe(
      first.url,
    );
  });
});

describe("cardLogoUrl", () => {
  it("asks Cloudinary for a PNG twice the size it's drawn, as the renderer can't read SVG", () => {
    expect(cardLogoUrl(`${CLOUDINARY}/v1/logo.svg`)).toBe(
      `${CLOUDINARY}/f_png,w_320,h_320,c_pad/v1/logo.svg`,
    );
  });
});

describe("cardPhotoUrl", () => {
  it("asks Cloudinary for a JPEG the card's width", () => {
    expect(cardPhotoUrl(`${CLOUDINARY}/v1/hero.webp`)).toBe(
      `${CLOUDINARY}/f_jpg,q_85,w_1200,c_limit/v1/hero.webp`,
    );
    expect(cardPhotoUrl("https://example.org/a.jpg")).toBe(
      "https://example.org/a.jpg",
    );
  });
});

describe("shorten", () => {
  it("cuts long text at a word", () => {
    expect(shorten("  short  text ", 20)).toBe("short text");
    expect(shorten("one two three four", 12)).toBe("one two…");
  });
});
