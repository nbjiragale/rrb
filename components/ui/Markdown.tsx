import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import type { PluggableList } from "unified";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
// Single newlines render as line breaks, matching the whitespace-pre-wrap
// behaviour these surfaces had before markdown, so hand-authored cards and
// stems keep their layout.
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
// KaTeX styles are self-hosted in public/katex and linked from app/layout.tsx,
// so math rendering never depends on the bundler resolving the npm package.

// errorColor: rehype-katex hardcodes #cc0000 for LaTeX it cannot parse; point it
// at the design token instead. strict "ignore" silences KaTeX's non-fatal
// warnings, which LLM-authored LaTeX trips constantly (unicode text, \text
// spacing) and which would otherwise flood the console.
const katexOptions = { errorColor: "var(--danger)", strict: "ignore" as const };

// Hoisted so react-markdown gets a stable plugin list instead of rebuilding its
// processor from fresh arrays on every render.
const remarkPlugins: PluggableList = [remarkGfm, remarkMath, remarkBreaks];
const rehypePlugins: PluggableList = [[rehypeKatex, katexOptions]];

// Phrasing-level renderers — valid inside a <button> or any inline context, so
// both the block and inline variants share them.
const phrasingComponents: Components = {
  strong: ({ children, ...p }) => (
    // Avoid weight 700+; use 600 instead, per design system.
    <strong className="font-semibold text-primary" {...p}>
      {children}
    </strong>
  ),
  em: ({ children, ...p }) => (
    <em className="italic text-primary" {...p}>
      {children}
    </em>
  ),
  code: ({ className, children, ...p }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={`font-mono text-small ${className ?? ""}`} {...p}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="font-mono text-[0.92em] bg-subtle border border-border rounded px-1.5 py-0.5 text-primary"
        {...p}
      >
        {children}
      </code>
    );
  },
  a: ({ children, href, ...p }) => (
    <a
      href={href}
      className="text-accent-strong underline underline-offset-2 hover:text-accent-hover"
      target="_blank"
      rel="noopener noreferrer"
      {...p}
    >
      {children}
    </a>
  ),
};

// Renderer for LLM-produced markdown (tutor answers, question stems, options,
// explanations, Feynman feedback). Styled to the design system: weights ≤600,
// hairline dividers, ivory tones, monospace for code. Type size and color are
// set on the wrapper so blocks inherit them and callers can restyle in one
// place. Reading column should still be capped at max-w-read by the caller.
const components: Components = {
  ...phrasingComponents,
  h1: ({ children, ...p }) => (
    <h2 className="text-h2 text-primary font-semibold mt-6 mb-3" {...p}>
      {children}
    </h2>
  ),
  h2: ({ children, ...p }) => (
    <h3 className="text-h3 text-primary font-semibold mt-6 mb-2" {...p}>
      {children}
    </h3>
  ),
  h3: ({ children, ...p }) => (
    <h4 className="text-body-lg text-primary font-semibold mt-5 mb-2" {...p}>
      {children}
    </h4>
  ),
  h4: ({ children, ...p }) => (
    <h5 className="text-body text-primary font-semibold mt-4 mb-1" {...p}>
      {children}
    </h5>
  ),
  p: ({ children, ...p }) => (
    <p className="my-3" {...p}>
      {children}
    </p>
  ),
  ul: ({ children, ...p }) => (
    <ul className="list-disc pl-6 my-3 space-y-1.5" {...p}>
      {children}
    </ul>
  ),
  ol: ({ children, ...p }) => (
    <ol className="list-decimal pl-6 my-3 space-y-1.5" {...p}>
      {children}
    </ol>
  ),
  li: ({ children, ...p }) => (
    <li className="leading-relaxed" {...p}>
      {children}
    </li>
  ),
  hr: ({ ...p }) => <hr className="my-6 border-t border-border" {...p} />,
  blockquote: ({ children, ...p }) => (
    <blockquote
      className="my-4 border-l-2 border-accent pl-4 text-secondary italic"
      {...p}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...p }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={`font-mono text-small ${className ?? ""}`} {...p}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="font-mono text-[0.92em] bg-subtle border border-border rounded px-1.5 py-0.5 text-primary"
        {...p}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...p }) => (
    <pre
      className="my-4 overflow-x-auto rounded-md border border-border bg-subtle p-4 font-mono text-small text-primary"
      {...p}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...p }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-body text-primary" {...p}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...p }) => (
    <th
      className="border-b border-border-strong px-3 py-2 text-left font-semibold"
      {...p}
    >
      {children}
    </th>
  ),
  td: ({ children, ...p }) => (
    <td className="border-b border-border px-3 py-2 align-top" {...p}>
      {children}
    </td>
  ),
};

// Inline variant: a paragraph must not emit <p>, because option rows render
// this inside a <button>, whose content model is phrasing-only.
const inlineComponents: Components = {
  ...phrasingComponents,
  p: ({ children, ...p }) => <span {...p}>{children}</span>,
};

// LLMs emit math with TeX delimiters \( … \) (inline) and \[ … \] (display), but
// remark-math only recognises $ … $ / $$ … $$. Without this, the backslash-paren
// is consumed as a markdown escape and the raw LaTeX (\frac, \text, …) leaks
// through as plain text. Normalise both forms to dollar delimiters before
// parsing so the math actually renders.
//
// Block math must be emitted with the $$ fences on their own lines: micromark
// only treats $$ as *flow* (display) math in that form, so a single-line
// $$ … $$ would otherwise render inline — cramped fractions, no centering.
// That also applies to $$ … $$ the model already wrote on a line by itself,
// which by convention means display; $$ … $$ mid-sentence stays inline.
function toDollarDelimiters(src: string): string {
  return src
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, body) => blockMath(body))
    .replace(/^[ \t]*\$\$([^\n$][\s\S]*?)\$\$[ \t]*$/gm, (_, body) => blockMath(body))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, body) => `$${body}$`);
}

function blockMath(body: string): string {
  return `\n\n$$\n${body.trim()}\n$$\n\n`;
}

// Split on fenced code so the rewrite never mangles literal backslashes inside
// ``` blocks. One capture group ⇒ the fences land on odd indices.
function normalizeMath(src: string): string {
  return src
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
    .map((part, i) => (i % 2 === 1 ? part : toDollarDelimiters(part)))
    .join("");
}

// Memoised: parsing markdown and laying out KaTeX costs ~4ms for a math
// question, and this sits inside components that re-render for unrelated
// reasons — every composer keystroke, every exam timer tick. All three props
// are primitives, so the default shallow compare is exact.
export const Markdown = memo(function Markdown({
  children,
  className = "text-body-lg text-primary",
  inline = false,
}: {
  children: string;
  /** Replaces the default type styles; blocks inherit size and color from it. */
  className?: string;
  /** Render phrasing-only output, for use inside buttons and other inline slots. */
  inline?: boolean;
}) {
  const markdown = (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={inline ? inlineComponents : components}
    >
      {normalizeMath(children)}
    </ReactMarkdown>
  );

  if (inline) return <span className={className}>{markdown}</span>;

  // Trim the outer block margins so the caller's padding controls the edges.
  return (
    <div className={`[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${className}`}>
      {markdown}
    </div>
  );
});
