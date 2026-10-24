import Markdown from "./elements/Markdown";
import DismissibleBanner from "./DismissibleBanner";

interface BannerProps {
  topBannerText: string | null;
  closeText: string | null;
}

/**
 * The notice above the navbar on every page. Its text is rendered here, on
 * the server: rendered in the browser, it would put the whole Markdown
 * renderer in every page's JavaScript.
 */
export default function Banner({ topBannerText, closeText }: BannerProps) {
  if (!topBannerText) {
    return null;
  }

  return (
    <DismissibleBanner closeText={closeText}>
      <Markdown className="prose-invert [&_a]:font-semibold [&_a]:underline [&_a]:decoration-from-font [&_a:hover]:text-slate-200 [&>p]:m-0">
        {topBannerText}
      </Markdown>
    </DismissibleBanner>
  );
}
