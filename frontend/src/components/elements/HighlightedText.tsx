interface HighlightedTextProps {
  text: string | null;
}

/**
 * A line of CMS text with its **marked** parts highlighted, without the
 * paragraph Markdown would wrap it in, so it fits in a heading.
 */
export default function HighlightedText({ text }: HighlightedTextProps) {
  return (text ?? "").split("**").map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-bold tracking-tight text-primary-700">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
