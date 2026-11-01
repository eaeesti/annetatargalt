import { describe, expect, it } from "vitest";
import {
  cleanDescription,
  emailPictureUrl,
  imageType,
  isOurImage,
} from "../email-image";

// The media library's Cloudinary account, as the tests' pictures have it
process.env.CLOUDINARY_NAME = "demo";

const bytes = (...values: number[]) => Buffer.from(values);

describe("imageType", () => {
  it("knows a picture by its first bytes", () => {
    expect(imageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(
      imageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime,
    ).toBe("image/png");
    expect(imageType(Buffer.from("GIF89a..."))?.mime).toBe("image/gif");
    expect(imageType(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))?.mime).toBe(
      "image/webp",
    );
  });

  it("takes nothing else, an SVG least of all", () => {
    expect(
      imageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')),
    ).toBeNull();
    expect(imageType(Buffer.from("<html>"))).toBeNull();
    expect(imageType(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(imageType(Buffer.alloc(0))).toBeNull();
    expect(imageType(bytes(0x89, 0x50))).toBeNull();
  });
});

describe("cleanDescription", () => {
  it("makes one line that can't end the Markdown early", () => {
    expect(cleanDescription(" Mari [annetamas]\n\tTallinnas ")).toBe(
      "Mari annetamas Tallinnas",
    );
    expect(cleanDescription("x".repeat(400))).toHaveLength(300);
    expect(cleanDescription(42)).toBe("");
  });
});

describe("emailPictureUrl", () => {
  const ours =
    "https://res.cloudinary.com/demo/image/upload/v17/kampaania_ab12";

  it("asks for ours at most 1200 wide, as a JPEG unless a PNG or a GIF", () => {
    expect(emailPictureUrl(`${ours}.webp`)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_1200,q_auto/v17/kampaania_ab12.jpg",
    );
    expect(emailPictureUrl(`${ours}.png`)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_1200,q_auto/v17/kampaania_ab12.png",
    );
    expect(emailPictureUrl(`${ours}.gif`)).toMatch(/\.gif$/);
  });

  it("leaves anyone else's alone", () => {
    const theirs = "https://example.org/picture.webp";
    expect(isOurImage(theirs)).toBe(false);
    expect(emailPictureUrl(theirs)).toBe(theirs);
    // Another account on Cloudinary is someone else too
    const otherAccount =
      "https://res.cloudinary.com/someone/image/upload/v1/picture.webp";
    expect(isOurImage(otherAccount)).toBe(false);
    expect(emailPictureUrl(otherAccount)).toBe(otherAccount);
  });
});
