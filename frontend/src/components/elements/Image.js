import NextImage from "next/image";

export default function Image({
  data,
  className,
  fill = false,
  priority = false,
}) {
  const image = data.data?.attributes;

  if (!image) {
    return (
      <NextImage
        className={className}
        src="https://placekitten.com/320/320"
        alt="Placeholder kitten"
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
