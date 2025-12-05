import * as React from 'react';
import { cn } from '@/lib/utils';
import { codeToHtml } from 'shiki';
import { RiFileCopyLine, RiCheckLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';

// Code block container
interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        'not-prose relative overflow-hidden rounded-lg border border-cb-border-primary bg-cb-ink-subtle/5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Code block with syntax highlighting
interface CodeBlockCodeProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
  language?: string;
  theme?: string;
}

export function CodeBlockCode({
  code,
  language = 'tsx',
  theme = 'github-dark',
  className,
  ...props
}: CodeBlockCodeProps) {
  const [html, setHtml] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);

  // Escape HTML entities to prevent XSS
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#039;');

  React.useEffect(() => {
    let mounted = true;

    codeToHtml(code, {
      lang: language,
      theme,
    }).then((result) => {
      if (mounted) {
        setHtml(result);
      }
    }).catch(() => {
      // Fallback to plain code if shiki fails (sanitized to prevent XSS)
      if (mounted) {
        setHtml(`<pre><code>${escapeHtml(code)}</code></pre>`);
      }
    });

    return () => {
      mounted = false;
    };
  }, [code, language, theme]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('relative', className)} {...props}>
      {/* Copy button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute right-2 top-2 h-8 w-8 p-0 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? (
          <RiCheckLine className="h-4 w-4 text-vibe-orange" />
        ) : (
          <RiFileCopyLine className="h-4 w-4 text-cb-ink-muted" />
        )}
      </Button>

      {/* Code content */}
      <div
        className="overflow-x-auto p-4 text-sm [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:font-mono"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// Code block with header (language, filename, actions)
interface CodeBlockGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CodeBlockGroup({ children, className, ...props }: CodeBlockGroupProps) {
  return (
    <div className={cn('group', className)} {...props}>
      {children}
    </div>
  );
}

// Code block header
interface CodeBlockHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  language?: string;
  filename?: string;
  children?: React.ReactNode;
}

export function CodeBlockHeader({ language, filename, children, className, ...props }: CodeBlockHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-cb-border-subtle bg-cb-ink-subtle/10 px-4 py-2',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 text-xs text-cb-ink-muted">
        {filename && <span className="font-medium">{filename}</span>}
        {language && !filename && <span>{language}</span>}
      </div>
      {children}
    </div>
  );
}
