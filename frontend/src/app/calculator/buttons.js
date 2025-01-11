import { GCEvent } from "next-goatcounter";
import {
  fixedEncodeURIComponent,
  openPopup,
  preventingDefault,
} from "./utils/utils";
import { FacebookIcon, LinkedInIcon, TwitterIcon } from "./icons";

function ShareButton({ text, color, Icon, url, name }) {
  return (
    <a
      href={url}
      target="_blank"
      onClick={preventingDefault(() => {
        GCEvent(`${name}-share-click`);
        openPopup(url, text);
      })}
      rel="noreferrer"
      className={`flex select-none flex-row items-center justify-center space-x-4 whitespace-nowrap rounded-md px-4 py-3 font-semibold tracking-tight text-white transition-opacity hover:opacity-90 sm:space-x-5 sm:text-xl`}
      style={{ backgroundColor: color }}
    >
      <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
      <div>{text}</div>
    </a>
  );
}

export function FacebookShareButton({ buttonText, url }) {
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${fixedEncodeURIComponent(
    url,
  )}&p=Facebook%20share%20popup`;
  return (
    <ShareButton
      text={buttonText}
      color="#4267B2"
      Icon={FacebookIcon}
      url={shareUrl}
      name="facebook"
    />
  );
}

export function TwitterShareButton({ buttonText, url, tweet, hashtags }) {
  const shareUrl = `https://twitter.com/intent/tweet?hashtags=${hashtags.join(
    ",",
  )}&url=${fixedEncodeURIComponent(url)}&text=${fixedEncodeURIComponent(
    tweet,
  )}`;
  return (
    <ShareButton
      text={buttonText}
      color="#1DA1F2"
      Icon={TwitterIcon}
      url={shareUrl}
      name="twitter"
    />
  );
}

export function LinkedInShareButton({ buttonText, url }) {
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${fixedEncodeURIComponent(
    url,
  )}`;
  return (
    <ShareButton
      text={buttonText}
      color="#0077B5"
      Icon={LinkedInIcon}
      url={shareUrl}
      name="linkedin"
    />
  );
}
