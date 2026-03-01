import NextImage from "next/image";

export default function Image({
  data,
  className,
  fill = false,
  priority = false,
}) {
  // In Strapi v5, media is returned flat (not nested under data.attributes)
  const image = data;

  if (!image) {
    return (
      <NextImage
        className={className}
        src="https://placehold.co/320x320.png"
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
        alt={image.alternativeText}
        fill={true}
        priority={priority}
      />
    );
  }

  return (
    <NextImage
      className={className}
      src={image.url}
      alt={image.alternativeText}
      width={image.width}
      height={image.height}
      priority={priority}
    />
  );
}
