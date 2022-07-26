import { getStrapiMedia } from "utils/media";
import Image from "next/image";
import PropTypes from "prop-types";
import { mediaPropTypes } from "utils/types";

const NextImage = ({ media, className, ...props }) => {
  const { url, alternativeText } = media;

  const loader = ({ src }) => {
    return getStrapiMedia(src);
  };

  // The image has a fixed width and height
  if (props.width && props.height) {
    return (
      <Image
        className={className}
        loader={loader}
        src={url}
        alt={alternativeText || ""}
        {...props}
      />
    );
  }

  // The image is responsive
  return (
    <Image
      className={className}
      loader={loader}
      layout="responsive"
      width={media.width}
      height={media.height}
      objectFit="contain"
      src={url}
      alt={alternativeText || ""}
    />
  );
};

Image.propTypes = {
  media: mediaPropTypes,
  className: PropTypes.string,
};

export default NextImage;
