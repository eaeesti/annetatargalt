import { icons } from "../SocialMediaIcon";
import { classes } from "@/utils/react";
import { usePlausible } from "next-plausible";

interface ShareButtonsProps {
  message: string | null;
  facebookText: string | null;
  twitterText: string | null;
  blueskyText: string | null;
  linkedinText: string | null;
}

/**
 * The page, without its query, in each network's share dialog. Facebook takes
 * only the page; the others get a post with the message and the page in it.
 * LinkedIn's own share link takes only the page too, and then shows nothing
 * but a preview it fetches of it, so its link that fills in a post is used.
 */
function shareLinks(message: string) {
  const page = `${window.location.origin}${window.location.pathname}`;
  const post = encodeURIComponent(message ? `${message} ${page}` : page);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(page)}`,
    twitter: `https://twitter.com/intent/tweet?text=${post}`,
    bluesky: `https://bsky.app/intent/compose?text=${post}`,
    linkedin: `https://www.linkedin.com/feed/?shareActive=true&text=${post}`,
  };
}

/** Buttons that open a network's share dialog in a small window. */
export default function ShareButtons({
  message,
  facebookText,
  twitterText,
  blueskyText,
  linkedinText,
}: ShareButtonsProps) {
  const plausible = usePlausible();
  const networks = [
    { network: "facebook", text: facebookText, color: "bg-[#1877f2]" },
    { network: "twitter", text: twitterText, color: "bg-[#1da1f2]" },
    { network: "bluesky", text: blueskyText, color: "bg-[#1185fe]" },
    { network: "linkedin", text: linkedinText, color: "bg-[#0a66c2]" },
  ] as const;

  return (
    <div className="grid w-full gap-3 xs:grid-cols-2 sm:flex sm:flex-wrap sm:justify-center">
      {networks.map(({ network, text, color }) => {
        if (!text) return null;
        const Icon = icons[network].icon;
        return (
          <button
            key={network}
            type="button"
            className={classes(
              color,
              "flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap text-white hover:opacity-90",
            )}
            onClick={() => {
              plausible(`income-shared-${network}`);
              window.open(
                shareLinks(message ?? "")[network],
                "share",
                "toolbar=0,status=0,width=720,height=500",
              );
            }}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {text}
          </button>
        );
      })}
    </div>
  );
}
