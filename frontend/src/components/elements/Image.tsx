import NextImage from "next/image";
import type { StrapiImage, StrapiMedia } from "@/types/generated/strapi";
import { imageSource } from "@/utils/image";

interface ImageProps {
  data: StrapiImage | StrapiMedia | null;
  className?: string;
  fill?: boolean;
  priority?: boolean;
}

export default function Image({
  data,
  className,
  fill = false,
  priority = false,
}: ImageProps) {
  const source = imageSource(data);

  if (!source) {
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
        src={source.file.url}
        alt={source.alt}
        fill={true}
        priority={priority}
      />
    );
  }

  return (
    <NextImage
      className={className}
      src={source.file.url}
      alt={source.alt}
      width={source.file.width ?? undefined}
      height={source.file.height ?? undefined}
      priority={priority}
    />
  );
}
