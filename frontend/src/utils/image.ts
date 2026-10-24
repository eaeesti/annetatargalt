import type { StrapiImage, StrapiMedia } from "@/types/generated/strapi";

/**
 * The file and description to show for an image. Images are Image components
 * whose description goes with where they're used; a decorative one gets an
 * empty description so screen readers skip it.
 *
 * A bare media file is also accepted, with the media library's description:
 * that is what Strapi returns until it has converted its image fields, so the
 * frontend works on either side of the deploy that converts them.
 */
export function imageSource(
  image: StrapiImage | StrapiMedia | null | undefined,
): { file: StrapiMedia; alt: string } | null {
  if (!image) return null;
  if (!("file" in image)) {
    return { file: image, alt: image.alternativeText ?? "" };
  }
  if (!image.file) return null;
  return { file: image.file, alt: image.decorative ? "" : (image.alt ?? "") };
}
