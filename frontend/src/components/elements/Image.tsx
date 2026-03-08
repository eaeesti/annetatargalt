import NextImage from "next/image";
import type { StrapiMedia } from "@/types/generated/strapi";

interface ImageProps {
  data: StrapiMedia | null;
  className?: string;
  fill?: boolean;
  priority?: boolean;
}

export default function Image({ data, className, fill = false, priority = false }: ImageProps) {
  // In Strapi v5, media is returned flat (not nested under data.attributes)
  const image = data;

  if (!image) {
    return (
      <NextImage
        className={className}
        src="https://placehold.co/320x320.png"
        alt=""
        width={320}
        height={320}
      />
    );
  }

  if (fill) {
    return (
      <NextImage
        className={className}
        src={image.url}
        alt={image.alternativeText ?? ""}
        fill={true}
        priority={priority}
      />
    );
  }

  return (
    <NextImage
      className={className}
      src={image.url}
      alt={image.alternativeText ?? ""}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      priority={priority}
    />
  );
}
