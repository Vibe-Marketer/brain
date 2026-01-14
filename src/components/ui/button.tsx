/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  /**
   * Button variants:
   * - `default`: Primary slate gradient glossy button (main CTAs)
   * - `destructive`: Red gradient glossy button (delete/remove actions)
   * - `hollow`: Plain bordered button (secondary actions, toolbars)
   * - `outline`: Subtle bordered button for toggleable/selectable items (pairs with `default` for selected state)
   * - `ghost`: Transparent button with hover state (icon toolbars, minimal UI)
   * - `link`: Text-only with underline (tertiary actions, inline links)
   */
  variant?: "default" | "destructive" | "hollow" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
}

// Size style objects - matching border radius across all button types
const sizeStyles = {
  sm: {
    height: '36px',
    fontSize: '14px',
    padding: '0 20px',
    borderRadius: '10px',  // Matches hollow button rounded-xl
    minWidth: '100px',
    fontWeight: '500',
  },
  default: {
    height: '40px',
    fontSize: '16px',
    padding: '0 24px',
    borderRadius: '12px',  // Matches hollow button rounded-xl
    minWidth: '120px',
    fontWeight: '500',
  },
  lg: {
    height: '44px',
    fontSize: '17px',
    padding: '0 28px',
    borderRadius: '16px',  // Matches hollow button rounded-xl
    minWidth: '135px',
    fontWeight: '500',
  },
};

// Variant styles - 3D glossy buttons (default = slate, destructive = red)
// Colors use CSS custom properties for maintainability
const getVariantStyles = (variant: string, size: string) => {
  const shadowScale = size === 'sm' ? 0.8 : size === 'lg' ? 1.1 : 1;

  switch (variant) {
    case 'default':
      // Primary slate gradient button - uses design token colors
      return {
        background: 'var(--btn-gradient-slate, linear-gradient(160deg, hsl(213 14% 45%) 0%, hsl(207 19% 28%) 100%))',
        color: 'hsl(var(--btn-text-primary))',
        borderColor: 'hsl(207 19% 28% / 0.8)',
        borderWidth: '1px',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
        boxShadow: `
          0 ${4 * shadowScale}px ${6 * shadowScale}px rgba(255, 255, 255, 0.25) inset,
          0 ${-4 * shadowScale}px ${6 * shadowScale}px rgba(0, 0, 0, 0.35) inset,
          0 ${10 * shadowScale}px ${20 * shadowScale}px rgba(61, 74, 91, 0.2)
        `,
      };
    case 'destructive':
      // Destructive red gradient button - uses design token colors
      return {
        background: 'var(--btn-gradient-destructive, linear-gradient(160deg, hsl(0 74% 60%) 0%, hsl(0 56% 51%) 100%))',
        color: 'hsl(var(--btn-text-primary))',
        borderColor: 'hsl(0 59% 47% / 0.8)',
        borderWidth: '1px',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
        boxShadow: `
          0 ${4 * shadowScale}px ${6 * shadowScale}px rgba(255, 255, 255, 0.25) inset,
          0 ${-4 * shadowScale}px ${6 * shadowScale}px rgba(0, 0, 0, 0.3) inset,
          0 ${10 * shadowScale}px ${20 * shadowScale}px rgba(0, 0, 0, 0.15)
        `,
      };
    default:
      return {};
  }
};

// Export buttonVariants for compatibility with components that use it
export const buttonVariants = (props?: { variant?: ButtonProps['variant']; size?: ButtonProps['size']; className?: string }) => {
  const { variant = 'default', size = 'default', className = '' } = props || {};
  return cn(
    'glossy-button',
    `glossy-size-${size}`,
    `glossy-variant-${variant}`,
    className
  );
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    // Special case: icon buttons
    if (size === 'icon' || size === 'icon-sm') {
      // Hollow variant icon buttons get solid borders and white background
      if (variant === 'hollow') {
        return (
          <Comp
            ref={ref}
            className={cn(
              size === 'icon-sm' ? 'h-6 w-6' : 'h-8 w-8',
              'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium',
              'border border-cb-border dark:border-cb-border-dark',
              'bg-white dark:bg-card',
              'text-ink dark:text-white',
              'hover:bg-cb-hover dark:hover:bg-cb-panel-dark',
              'ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
              className
            )}
            {...props}
          />
        );
      }

      // Outline variant icon buttons get subtle borders
      if (variant === 'outline') {
        return (
          <Comp
            ref={ref}
            className={cn(
              size === 'icon-sm' ? 'h-6 w-6' : 'h-8 w-8',
              'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium',
              'border border-cb-border-soft dark:border-cb-border-dark',
              'bg-transparent',
              'text-ink-soft dark:text-cb-text-dark-secondary',
              'hover:bg-cb-hover hover:text-ink hover:border-cb-border',
              'dark:hover:bg-cb-panel-dark dark:hover:text-white',
              'ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
              className
            )}
            {...props}
          />
        );
      }

      // Ghost variant icon buttons (no border, transparent) - default for icon buttons
      return (
        <Comp
          ref={ref}
          className={cn(
            size === 'icon-sm' ? 'h-6 w-6' : 'h-8 w-8',
            'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium',
            'bg-transparent',
            'text-ink-muted dark:text-cb-text-dark-secondary',
            'hover:bg-cb-hover hover:text-ink',
            'dark:hover:bg-cb-panel-dark dark:hover:text-white',
            'ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
            className
          )}
          {...props}
        />
      );
    }
    
    // Special case: link variant - uses design tokens for text color
    if (variant === 'link') {
      return (
        <Comp
          ref={ref}
          className={cn(
            'bg-transparent border-none underline-offset-4 cursor-pointer font-medium p-0 h-auto',
            'text-ink dark:text-white',
            'hover:underline inline-flex items-center justify-center',
            className
          )}
          {...props}
        />
      );
    }

    // Special case: hollow variant (plain button - simple border, no glossy effects)
    if (variant === 'hollow') {
      return (
        <Comp
          ref={ref}
          className={cn(
            'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors',
            'border bg-white dark:bg-card',
            'text-ink dark:text-white',
            'border-cb-border dark:border-cb-border-dark',
            'hover:bg-cb-hover dark:hover:bg-cb-panel-dark',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
            size === 'sm' && 'h-9 px-5 text-[13px] rounded-xl',      // 12px to match glossy
            size === 'default' && 'h-10 px-6 text-[13px] rounded-xl', // 12px
            size === 'lg' && 'h-11 px-7 text-[13px] rounded-xl',      // 12px
            className
          )}
          {...props}
        />
      );
    }

    // Special case: outline variant (subtle bordered button for toggleable/selectable items)
    // Designed to pair with variant="default" for selected state
    if (variant === 'outline') {
      return (
        <Comp
          ref={ref}
          className={cn(
            'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all',
            'border bg-transparent',
            'text-ink-soft dark:text-cb-text-dark-secondary',
            'border-cb-border-soft dark:border-cb-border-dark',
            'hover:bg-cb-hover hover:text-ink hover:border-cb-border',
            'dark:hover:bg-cb-panel-dark dark:hover:text-white dark:hover:border-cb-border-dark',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
            size === 'sm' && 'h-8 px-3 text-xs rounded-lg',
            size === 'default' && 'h-9 px-4 text-sm rounded-lg',
            size === 'lg' && 'h-10 px-5 text-sm rounded-lg',
            className
          )}
          {...props}
        />
      );
    }

    // Special case: ghost variant (transparent button with subtle hover)
    // Used for icon toolbars, minimal UI contexts
    if (variant === 'ghost') {
      return (
        <Comp
          ref={ref}
          className={cn(
            'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors',
            'bg-transparent',
            'text-ink-muted dark:text-cb-text-dark-secondary',
            'hover:bg-cb-hover hover:text-ink',
            'dark:hover:bg-cb-panel-dark dark:hover:text-white',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
            size === 'sm' && 'h-8 px-3 text-xs rounded-lg',
            size === 'default' && 'h-9 px-4 text-sm rounded-lg',
            size === 'lg' && 'h-10 px-5 text-sm rounded-lg',
            className
          )}
          {...props}
        />
      );
    }

    // Glossy button with exact size matching
    const buttonStyle = {
      ...sizeStyles[size],
      ...getVariantStyles(variant, size),
      borderStyle: 'solid',
      cursor: 'pointer',
      position: 'relative' as const,
      overflow: 'hidden',
      transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      textAlign: 'center' as const,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      whiteSpace: 'nowrap' as const,
      outline: '2px solid transparent',
      outlineOffset: '2px',
    };
    
    return (
      <>
        <Comp
          ref={ref}
          style={buttonStyle}
          className={cn(
            'glossy-button',
            `glossy-size-${size}`,
            `glossy-variant-${variant}`,
            'disabled:pointer-events-none disabled:opacity-50',
            '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
            className
          )}
          {...props}
        />
        <style>{`
          .glossy-button {
            transition: 
              transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
              outline 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
          }
          
          .glossy-button:hover {
            /* No transform on hover - stays in place */
          }
          
          .glossy-button:active {
            transform: translateY(1px) scale(0.98) !important;
            transition-duration: 0.1s;
          }
          
          .glossy-button.glossy-variant-default:active,
          .glossy-button.glossy-variant-destructive:active {
            outline: 2px solid hsl(32 100% 50%) !important;
            outline-offset: 2px;
          }
        `}</style>
      </>
    );
  }
);
Button.displayName = "Button";

export { Button };
