import { describe, it, expect } from "vitest";
import { imageSource } from "../image";
import type { StrapiMedia } from "@/types/generated/strapi";

const file: StrapiMedia = {
  id: 1,
  documentId: "file1",
  url: "https://example.com/cows.jpg",
  alternativeText: "Lehmad",
  width: 800,
  height: 600,
  formats: null,
  name: "cows.jpg",
  mime: "image/jpeg",
  size: 100,
};

describe("imageSource", () => {
  it("uses the Image component's own description, not the media library's", () => {
    expect(
      imageSource({ id: 1, file, alt: "Cows", decorative: false }),
    ).toEqual({ file, alt: "Cows" });
  });

  it("gives a decorative image an empty description", () => {
    expect(imageSource({ id: 1, file, alt: "Cows", decorative: true })).toEqual(
      { file, alt: "" },
    );
  });

  it("has nothing to show for an Image component without a file", () => {
    expect(
      imageSource({ id: 1, file: null, alt: "Cows", decorative: false }),
    ).toBeNull();
    expect(imageSource(null)).toBeNull();
  });
});
