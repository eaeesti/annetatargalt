import type { StrapiImage, StrapiMedia } from "@/types/generated/strapi";

/**
 * The file and description to show for an Image component. The description
 * goes with where the image is used; a decorative image gets an empty one so
 * screen readers skip it.
 */
export function imageSource(
  image: StrapiImage | null | undefined,
): { file: StrapiMedia; alt: string } | null {
  if (!image?.file) return null;
  return { file: image.file, alt: image.decorative ? "" : (image.alt ?? "") };
}
