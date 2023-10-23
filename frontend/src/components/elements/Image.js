import NextImage from "next/image";

export default function Image({ data, className, fill = false }) {
  const image = data.data?.attributes;

  if (!image) {
    return (
      <NextImage
        className={className}
        alt="Not found"
        width={200}
        height={200}
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
    />
  );
}
