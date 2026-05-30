import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Renderer for LLM-produced markdown (tutor answers, explanations, Feynman
// feedback). Styled to the design system: weights ≤600, hairline dividers,
// ivory tones, monospace for code. Reading column should still be capped at
// max-w-read by the caller.
const components: Components = {
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
    <p className="text-body-lg text-primary my-3" {...p}>
      {children}
    </p>
  ),
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
  ul: ({ children, ...p }) => (
    <ul className="list-disc pl-6 my-3 space-y-1.5 text-body-lg text-primary" {...p}>
      {children}
    </ul>
  ),
  ol: ({ children, ...p }) => (
    <ol className="list-decimal pl-6 my-3 space-y-1.5 text-body-lg text-primary" {...p}>
      {children}
    </ol>
  ),
  li: ({ children, ...p }) => (
    <li className="text-body-lg text-primary leading-relaxed" {...p}>
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

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
