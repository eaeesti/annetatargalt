import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Anchor from "../elements/Anchor";

export default function Markdown({ text, className }) {
  return (
    <ReactMarkdown
      children={text}
      remarkPlugins={[remarkGfm]}
      className={className}
      components={{
        a(props) {
          const { children, href, node, ...rest } = props;
          const newTab = href.startsWith("http");
          return (
            <Anchor href={href} newTab={newTab} {...rest}>
              {children}
            </Anchor>
          );
        },
      }}
    />
  );
}
