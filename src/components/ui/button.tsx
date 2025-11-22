import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "destructive" | "hollow" | "link" | "outline" | "secondary";
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
const getVariantStyles = (variant: string, size: string) => {
  const shadowScale = size === 'sm' ? 0.8 : size === 'lg' ? 1.1 : 1;

  switch (variant) {
    case 'default':
      return {
        background: 'linear-gradient(160deg, #627285 0%, #394655 100%)',  // Slate gradient
        color: 'white',
        borderColor: 'rgba(57, 70, 85, 0.8)',
        borderWidth: '1px',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
        boxShadow: `
          0 ${4 * shadowScale}px ${6 * shadowScale}px rgba(255, 255, 255, 0.25) inset,
          0 ${-4 * shadowScale}px ${6 * shadowScale}px rgba(0, 0, 0, 0.35) inset,
          0 ${10 * shadowScale}px ${20 * shadowScale}px rgba(61, 74, 91, 0.2)
        `,
      };
    case 'destructive':
      return {
        background: 'linear-gradient(160deg, #E54D4D 0%, #C93A3A 100%)',
        color: 'white',
        borderColor: 'rgba(190, 50, 50, 0.8)',
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
      // Hollow variant icon buttons get borders
      if (variant === 'hollow') {
        return (
          <Comp
            ref={ref}
            className={cn(
              size === 'icon-sm' ? 'h-6 w-6' : 'h-8 w-8',
              'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium',
              'border border-cb-border dark:border-cb-border-dark',
              'bg-white dark:bg-card',
              'text-cb-ink dark:text-white',
              'hover:bg-cb-hover dark:hover:bg-cb-panel-dark',
              'ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-green focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
              className
            )}
            {...props}
          />
        );
      }

      // Ghost variant icon buttons (no border, transparent)
      return (
        <Comp
          ref={ref}
          className={cn(
            size === 'icon-sm' ? 'h-6 w-6' : 'h-8 w-8',
            'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium',
            'bg-transparent hover:bg-muted/50',
            'text-cb-ink dark:text-white',
            'ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
            className
          )}
          {...props}
        />
      );
    }
    
    // Special case: link variant
    if (variant === 'link') {
      return (
        <Comp
          ref={ref}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#1a1a1a',
            textDecoration: 'underline-offset-4',
            cursor: 'pointer',
            fontWeight: '500',
            padding: '0',
            height: 'auto',
          }}
          className={cn('hover:underline inline-flex items-center justify-center', className)}
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
            'text-cb-ink dark:text-white',
            'border-cb-border dark:border-cb-border-dark',
            'hover:bg-cb-hover dark:hover:bg-cb-panel-dark',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-green focus-visible:ring-offset-2',
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
            outline: 2px solid #a5d96a !important;
            outline-offset: 2px;
          }
        `}</style>
      </>
    );
  }
);
Button.displayName = "Button";

export { Button };
