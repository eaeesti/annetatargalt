import NextImage from "next/image";

export default function Image({ data, className }) {
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
