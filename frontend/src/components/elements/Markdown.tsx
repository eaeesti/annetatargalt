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

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      className={className}
      components={{
        // node is destructured to exclude it from ...rest (passing it to the DOM causes a warning)
        a({ children, href, node: _node, ...rest }) {
          return (
            <Anchor href={href ?? "#"} newTab={openInNewTab(href)} {...rest}>
              {children ?? ""}
            </Anchor>
          );
        },
      }}
    >
      {children ?? ""}
    </ReactMarkdown>
  );
}
