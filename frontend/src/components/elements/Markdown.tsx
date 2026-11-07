import { ArrowUturnLeftIcon } from "@heroicons/react/20/solid";
import type { Element, Root } from "hast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import Anchor from "../elements/Anchor";

/**
 * CMS content is authored as markdown by Strapi editors, and rehypeRaw lets
 * raw HTML through it so the chart embeds on the cause pages keep working.
 * That same door would let anyone who can edit content put a <script> on the
 * donation page and read names, emails and personal codes out of the form as
 * donors type them — so everything raw goes straight through the sanitizer.
 *
 * Plugin order is load-bearing: rehypeRaw parses the HTML into real nodes,
 * and rehypeSanitize then deletes everything not named here. Reversing them
 * would sanitize the escaped text and then happily parse the HTML afterwards,
 * which is the same as having no sanitizer at all.
 *
 * iframe is the one addition to the default allowlist, because the cause
 * pages embed charts. The sanitizer cannot restrict *where* an iframe points
 * (its protocol check only rules out things like javascript:), so the
 * frame-src directive in next.config.mjs is what pins that down to the chart
 * host. The two work together; neither is sufficient alone.
 */
export const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "iframe"],
  attributes: {
    ...defaultSchema.attributes,
    // width, height and title already come from the schema's global list.
    // style is needed because the existing embeds size themselves inline.
    iframe: [
      "src",
      "style",
      "loading",
      "allow",
      "allowFullScreen",
      "frameBorder",
    ],
  },
};

/**
 * The sanitizer prefixes every id (and name) with `user-content-`, so content
 * can't clobber globals like `window.someId`. Links within the page aren't
 * rewritten to match, so `[^1]` footnotes and hand-written `#anchor` links
 * would point at ids that no longer exist.
 *
 * Footnotes are therefore generated without a prefix of their own
 * (remarkRehypeOptions below), the sanitizer adds it to the ids exactly once,
 * and this plugin — which must run after the sanitizer — adds it to the
 * fragment links. A link already written as `#user-content-…` is left alone.
 */
const clobberPrefix = defaultSchema.clobberPrefix ?? "user-content-";

export const remarkRehypeOptions = { clobberPrefix: "" };

export function prefixFragmentLinks() {
  return (tree: Root) => prefixLinksBelow(tree);
}

function prefixLinksBelow(node: Root | Element) {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    const href = child.properties.href;
    if (
      child.tagName === "a" &&
      typeof href === "string" &&
      href.length > 1 &&
      href.startsWith("#") &&
      !href.startsWith(`#${clobberPrefix}`)
    ) {
      child.properties.href = `#${clobberPrefix}${href.slice(1)}`;
    }
    prefixLinksBelow(child);
  }
}

interface MarkdownProps {
  children: string | null | undefined;
  className?: string;
  newTabs?: "external" | "all" | "none";
}

export default function Markdown({
  children,
  className,
  newTabs = "external",
}: MarkdownProps) {
  const openInNewTab = {
    external: (href: string | undefined) => (href ?? "").startsWith("http"),
    all: () => true,
    none: () => false,
  }[newTabs];

  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      remarkRehypeOptions={remarkRehypeOptions}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], prefixFragmentLinks]}
      components={{
        // node is destructured to exclude it from ...rest (passing it to the DOM causes a warning)
        a({ children, href, node: _node, ...rest }) {
          return (
            <Anchor href={href ?? "#"} newTab={openInNewTab(href)} {...rest}>
              {"data-footnote-backref" in rest ? (
                // The footnote's way back to its reference, which remark
                // writes as a "↩" character. aria-label names the link.
                <ArrowUturnLeftIcon
                  aria-hidden="true"
                  className="inline h-4 w-4 align-text-bottom"
                />
              ) : (
                (children ?? "")
              )}
            </Anchor>
          );
        },
      }}
    >
      {children ?? ""}
    </ReactMarkdown>
  );

  // react-markdown 10 dropped its className prop, which wrapped the output in
  // a div only when a class was given. Same markup as before.
  return className ? <div className={className}>{markdown}</div> : markdown;
}
