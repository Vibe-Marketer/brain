import * as React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { cn } from '@/lib/utils';
import { CodeBlock, CodeBlockCode } from './code-block';
import { Badge } from '@/components/ui/badge';

interface MarkdownProps extends React.HTMLAttributes<HTMLDivElement> {
  children: string;
  components?: Partial<Components>;
  /**
   * Callback when a "View" link is clicked (View Details, View Call, View Meeting, etc.).
   * Receives the recording_id extracted from the link href.
   */
  onViewCall?: (recordingId: number) => void;
}

// Default component overrides for markdown rendering
const INITIAL_COMPONENTS: Partial<Components> = {
  // Code blocks with syntax highlighting
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match;

    if (isInline) {
      return (
        <code
          className={cn(
            'rounded bg-cb-ink-subtle/10 px-1.5 py-0.5 font-mono text-sm',
            className
          )}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <CodeBlock className="not-prose my-4">
        <CodeBlockCode
          code={String(children).replace(/\n$/, '')}
          language={match[1]}
        />
      </CodeBlock>
    );
  },

  // Pre tags (wrapper for code blocks)
  pre: ({ children }) => <>{children}</>,

  // Links with proper styling - NO LONGER USED, replaced by factory function below
  // a: ({ href, children, ...props }) => (
  //   <a
  //     href={href}
  //     target="_blank"
  //     rel="noopener noreferrer"
  //     className="text-ink underline underline-offset-2 hover:text-ink-soft"
  //     {...props}
  //   >
  //     {children}
  //   </a>
  // ),

  // Tables with proper styling
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),

  th: ({ children, ...props }) => (
    <th
      className="border-b border-cb-border-primary px-4 py-2 text-left font-inter font-medium text-ink"
      {...props}
    >
      {children}
    </th>
  ),

  td: ({ children, ...props }) => (
    <td className="border-b border-cb-border-subtle px-4 py-2" {...props}>
      {children}
    </td>
  ),

  // Lists with proper spacing
  ul: ({ children, ...props }) => (
    <ul className="my-2 ml-6 list-disc space-y-1" {...props}>
      {children}
    </ul>
  ),

  ol: ({ children, ...props }) => (
    <ol className="my-2 ml-6 list-decimal space-y-1" {...props}>
      {children}
    </ol>
  ),

  // Blockquotes
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-4 border-l-4 border-vibe-orange pl-4 italic text-ink-muted"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Headings
  h1: ({ children, ...props }) => (
    <h1 className="mb-4 mt-6 font-montserrat text-2xl font-extrabold uppercase text-ink" {...props}>
      {children}
    </h1>
  ),

  h2: ({ children, ...props }) => (
    <h2 className="mb-3 mt-5 font-montserrat text-xl font-extrabold uppercase text-ink" {...props}>
      {children}
    </h2>
  ),

  h3: ({ children, ...props }) => (
    <h3 className="mb-2 mt-4 font-montserrat text-lg font-extrabold uppercase text-ink" {...props}>
      {children}
    </h3>
  ),

  // Paragraphs
  p: ({ children, ...props }) => (
    <p className="my-2 leading-relaxed" {...props}>
      {children}
    </p>
  ),

  // Strong/bold
  strong: ({ children, ...props }) => (
    <strong className="font-medium text-ink" {...props}>
      {children}
    </strong>
  ),

  // Horizontal rule
  hr: ({ ...props }) => <hr className="my-6 border-cb-border-primary" {...props} />,
};

/**
 * Extract recording_id from a link href.
 * Supports:
 * - Direct numeric ID: "123456"
 * - Fathom URL: "https://app.fathom.video/recordings/123456"
 */
function extractRecordingId(href: string | undefined): number | null {
  if (!href) return null;

  // Try parsing as direct numeric ID
  const directId = parseInt(href, 10);
  if (!isNaN(directId)) return directId;

  // Try extracting from Fathom URL pattern
  const fathomMatch = href.match(/\/recordings\/(\d+)/);
  if (fathomMatch) {
    const id = parseInt(fathomMatch[1], 10);
    if (!isNaN(id)) return id;
  }

  return null;
}

export function Markdown({ children, className, components, onViewCall, ...props }: MarkdownProps) {
  // Create link component with access to onViewCall
  const linkComponent = React.useMemo(() => {
    return ({ href, children: linkChildren, ...linkProps }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) => {
      // Check if this is a "View Details" or "View Call" link (any variation)
      const linkText = typeof linkChildren === 'string' ? linkChildren.toLowerCase() : '';
      const isViewLink = linkText === 'view details' ||
                         linkText === 'view call' ||
                         linkText === 'view meeting' ||
                         linkText.startsWith('view ');

      if (isViewLink) {
        // Render as a styled link that opens the Fathom share URL
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium no-underline",
              "bg-white dark:bg-card border-black dark:border-white",
              "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            )}
          >
            VIEW
          </a>
        );
      }

      // Default link rendering
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline underline-offset-2 hover:text-ink-soft"
          {...linkProps}
        >
          {linkChildren}
        </a>
      );
    };
  }, [onViewCall]);

  const mergedComponents = React.useMemo(
    () => ({
      ...INITIAL_COMPONENTS,
      a: linkComponent, // Override the commented-out link component
      ...components
    }),
    [components, linkComponent]
  );

  return (
    <div className={cn('font-inter font-light text-ink', className)} {...props}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={mergedComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
