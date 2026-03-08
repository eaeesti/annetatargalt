import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import Anchor from "../elements/Anchor";

interface MarkdownProps {
  children: string | null | undefined;
  className?: string;
  newTabs?: "external" | "all" | "none";
}

export default function Markdown({ children, className, newTabs = "external" }: MarkdownProps) {
  const openInNewTab = {
    external: (href: string | undefined) => (href ?? "").startsWith("http"),
    all: () => true,
    none: () => false,
  }[newTabs];

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      className={className}
      components={{
        a({ children, href, node, ...rest }) {
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
