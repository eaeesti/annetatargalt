import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import Anchor from "../elements/Anchor";

export default function Markdown({
  children,
  className,
  newTabs = "external",
}) {
  const openInNewTab = {
    external: (href) => href.startsWith("http"),
    all: () => true,
    none: () => false,
  }[newTabs];

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      className={className}
      components={{
        a(props) {
          const { children, href, node, ...rest } = props;
          return (
            <Anchor href={href} newTab={openInNewTab(href)} {...rest}>
              {children}
            </Anchor>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
