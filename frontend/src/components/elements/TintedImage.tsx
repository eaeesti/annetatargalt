import type { StrapiImage } from "@/types/generated/strapi";
import { imageSource } from "@/utils/image";

interface TintedImageProps {
  data: StrapiImage | null;
  className?: string;
}

/**
 * An image drawn in a single colour: its shape cuts a hole in a box filled
 * with the text colour (set it with a `bg-*` class).
 */
export default function TintedImage({ data, className }: TintedImageProps) {
  const source = imageSource(data);
  if (!source) return null;

  const { url, width, height } = source.file;

  return (
    <span
      role={source.alt ? "img" : undefined}
      aria-label={source.alt || undefined}
      aria-hidden={source.alt ? undefined : true}
      className={`inline-block mask-contain mask-center mask-no-repeat ${className ?? ""}`}
      style={{
        maskImage: `url(${url})`,
        aspectRatio: width && height ? `${width} / ${height}` : undefined,
      }}
    />
  );
}
