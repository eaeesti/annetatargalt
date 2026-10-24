import NextImage from "next/image";
import type { ImageProps as NextImageProps } from "next/image";
import type { StrapiImage } from "@/types/generated/strapi";
import { imageSource } from "@/utils/image";

/**
 * How the image loads, passed on to next/image. Below the fold, the defaults
 * (lazy, normal priority) are right. The page's main image above the fold
 * wants `preload` and `fetchPriority="high"`; anything else above the fold,
 * `loading="eager"`. `sizes` matters for any image wider than its slot on a
 * phone: without it, a phone gets the version for twice the image's width.
 */
type LoadingProps = Pick<
  NextImageProps,
  "preload" | "fetchPriority" | "loading" | "sizes" | "quality"
>;

interface ImageProps extends LoadingProps {
  data: StrapiImage | null;
  className?: string;
  fill?: boolean;
}

export default function Image({
  data,
  className,
  fill = false,
  ...loading
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
        {...loading}
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
      {...loading}
    />
  );
}
