import * as React from 'react';
import { cn } from '@/lib/utils';

type LoaderVariant =
  | 'circular'
  | 'dots'
  | 'typing'
  | 'pulse'
  | 'bars';

type LoaderSize = 'sm' | 'md' | 'lg';

interface LoaderProps {
  variant?: LoaderVariant;
  size?: LoaderSize;
  text?: string;
  className?: string;
}

const sizeMap = {
  sm: { dot: 'h-1.5 w-1.5', bar: 'h-3 w-0.5', circular: 'h-4 w-4' },
  md: { dot: 'h-2 w-2', bar: 'h-4 w-1', circular: 'h-6 w-6' },
  lg: { dot: 'h-2.5 w-2.5', bar: 'h-5 w-1.5', circular: 'h-8 w-8' },
};

export function Loader({ variant = 'dots', size = 'md', text, className }: LoaderProps) {
  const sizes = sizeMap[size];

  switch (variant) {
    case 'circular':
      return (
        <div className={cn('flex items-center gap-2', className)}>
          <svg
            className={cn('animate-spin text-cb-ink-muted', sizes.circular)}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {text && <span className="text-sm text-cb-ink-muted">{text}</span>}
        </div>
      );

    case 'dots':
      return (
        <div className={cn('flex items-center gap-1', className)}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                'animate-bounce rounded-full bg-cb-ink-muted',
                sizes.dot
              )}
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
          {text && <span className="ml-2 text-sm text-cb-ink-muted">{text}</span>}
        </div>
      );

    case 'typing':
      return (
        <div className={cn('flex items-center gap-1', className)}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                'rounded-full bg-cb-ink-muted',
                sizes.dot
              )}
              style={{
                animation: 'typing 1s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
          {text && <span className="ml-2 text-sm text-cb-ink-muted">{text}</span>}
        </div>
      );

    case 'pulse':
      return (
        <div className={cn('flex items-center gap-2', className)}>
          <span
            className={cn(
              'rounded-full bg-vibe-orange',
              sizes.dot
            )}
            style={{
              animation: 'pulse-dot 1.5s ease-in-out infinite',
            }}
          />
          {text && <span className="text-sm text-cb-ink-muted">{text}</span>}
        </div>
      );

    case 'bars':
      return (
        <div className={cn('flex items-end gap-0.5', className)}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                'rounded-sm bg-cb-ink-muted',
                sizes.bar
              )}
              style={{
                animation: 'wave-bars 1s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
          {text && <span className="ml-2 text-sm text-cb-ink-muted">{text}</span>}
        </div>
      );

    default:
      return null;
  }
}

// Thinking loader for AI responses
interface ThinkingLoaderProps {
  className?: string;
}

export function ThinkingLoader({ className }: ThinkingLoaderProps) {
  return (
    <div className={cn('flex items-center gap-2 text-cb-ink-muted', className)}>
      <Loader variant="dots" size="sm" />
      <span className="text-sm font-inter font-light">Thinking...</span>
    </div>
  );
}
