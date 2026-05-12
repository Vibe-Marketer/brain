/**
 * SelectionButton — canonical selection-state primitive
 *
 * Single source of truth for the CallVault canonical selection pattern:
 * - Vertical orange pill on the left edge (or bottom edge for horizontal orientation)
 * - Gray rounded background highlight (`bg-muted`) on selected
 * - BOLD title text on selected (no italic — see CONTEXT.md / BRAND-03)
 * - Icon in rounded-square container with orange ring on selected
 * - Optional secondary description line below title
 *
 * Used by:
 * - Sidebar nav (vertical, sm size)
 * - 2nd-pane workspace selector (vertical, sm size)
 * - Settings/Org/People/Analytics/Sorting category panes (vertical, sm size)
 * - Settings > Organizations card list (vertical, md size)
 * - Call Detail modal tabs (horizontal orientation)
 *
 * Polymorphic: renders as <button> (default), <a>, or <div role="button">
 * (the <div> path is for cases like the workspace row which has nested
 * Collapsible.Trigger that violates button-in-button HTML.)
 *
 * Tokens: uses semantic Tailwind/shadcn tokens only
 * (`bg-muted`, `bg-card`, `border-border`, `bg-vibe-orange`, `ring-vibe-orange`,
 * `text-foreground`, `text-muted-foreground`). Dark mode adapts automatically.
 *
 * @phase 33
 * @brand-version v4.4
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * cva variant set for the OUTER button/anchor/div element.
 *
 * Variants:
 *   - size: 'sm' | 'md' (currently visually identical; reserved for org-card density tweaks)
 *   - orientation: 'vertical' (default) | 'horizontal' (Call Detail modal tabs)
 *   - selected: boolean
 *
 * Compound variants handle pill placement + offset shifts per orientation.
 */
export const selectionButtonVariants = cva(
  [
    // Base layout + interactivity
    "relative flex rounded-lg text-left select-none",
    "transition-all duration-150 ease-in-out",
    "hover:bg-muted/70",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
  ],
  {
    variants: {
      orientation: {
        vertical: "w-full items-start gap-3",
        horizontal: "items-center gap-2",
      },
      size: {
        sm: "px-3 py-3",
        md: "px-3 py-3",
      },
      selected: {
        true: "bg-muted",
        false: "",
      },
    },
    compoundVariants: [
      // Vertical + selected: left-edge orange pill + pl-4 offset
      {
        orientation: "vertical",
        selected: true,
        className: cn(
          "pl-4",
          "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2",
          "before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
        ),
      },
      // Horizontal + selected: bottom-edge orange pill (centered, 65% width)
      {
        orientation: "horizontal",
        selected: true,
        className: cn(
          "before:content-[''] before:absolute before:bottom-0 before:left-1/2 before:-translate-x-1/2",
          "before:h-1 before:w-[65%] before:rounded-full before:bg-vibe-orange",
        ),
      },
    ],
    defaultVariants: {
      orientation: "vertical",
      size: "sm",
      selected: false,
    },
  },
);

const iconContainerVariants = cva(
  [
    "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
    "bg-card",
    "transition-all duration-300 ease-in-out",
  ],
  {
    variants: {
      selected: {
        true: "ring-2 ring-vibe-orange border-transparent",
        false: "border border-border",
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

const labelVariants = cva(
  ["block text-sm truncate transition-colors"],
  {
    variants: {
      selected: {
        true: "text-foreground font-bold",
        false: "text-foreground font-medium",
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

export interface SelectionButtonProps
  extends Omit<VariantProps<typeof selectionButtonVariants>, "selected"> {
  /** Whether this item is currently selected (drives pill, bg, bold, ring). */
  selected: boolean;
  /** Icon node — typically a Remix Icon component or emoji span. */
  icon: React.ReactNode;
  /** Optional active icon — falls back to `icon` when not provided. */
  iconActive?: React.ReactNode;
  /** Primary label text. */
  label: string;
  /** Optional secondary description rendered below the label. */
  description?: string;
  /** Right-edge chevron fades in on selected (vertical orientation only). */
  showChevron?: boolean;
  /** Polymorphic render: button (default), anchor, or div. */
  as?: "button" | "a" | "div";
  /** Click handler. */
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** Keydown handler (forwarded to the root element). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  /** Extra className passthrough. */
  className?: string;
  /** href when `as="a"`. */
  href?: string;
  /** title attribute for native tooltip. */
  title?: string;
  /** Disabled state (only meaningful for button). */
  disabled?: boolean;
  /** Accessibility: descriptive label. */
  "aria-label"?: string;
  /** Accessibility: aria-current (for nav rows). */
  "aria-current"?: React.AriaAttributes["aria-current"];
  /** Optional data-tour attribute for product tour targeting. */
  "data-tour"?: string;
  /**
   * Optional children — when provided, REPLACES the default
   * (icon + label/description + chevron) body. Use only for advanced
   * embeds (e.g. wrapping a Collapsible.Trigger that must be a sibling).
   * Most callers should leave this unset.
   */
  children?: React.ReactNode;
}

/**
 * Chevron rendered to the right of the label when `showChevron` + `selected`.
 * Fades in/translates when toggled.
 */
function SelectionChevron({ selected }: { selected: boolean }) {
  return (
    <div
      className={cn(
        "flex-shrink-0 mt-0.5",
        "transition-all duration-300 ease-in-out",
        selected ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1",
      )}
      aria-hidden="true"
    >
      <svg
        className="h-4 w-4 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </div>
  );
}

export const SelectionButton = React.forwardRef<HTMLElement, SelectionButtonProps>(
  function SelectionButton(
    {
      selected,
      icon,
      iconActive,
      label,
      description,
      orientation = "vertical",
      size = "sm",
      showChevron = false,
      as = "button",
      onClick,
      onKeyDown,
      className,
      href,
      title,
      disabled,
      children,
      "aria-label": ariaLabel,
      "aria-current": ariaCurrent,
      "data-tour": dataTour,
      ...rest
    },
    ref,
  ) {
    const composedClassName = cn(
      selectionButtonVariants({ orientation, size, selected }),
      // Horizontal: column-flex centers icon-above-label
      orientation === "horizontal" && "flex-col px-3 py-2",
      className,
    );

    const renderedIcon = selected && iconActive ? iconActive : icon;

    const body =
      children ?? (
        <>
          <div className={iconContainerVariants({ selected })} aria-hidden="true">
            {renderedIcon}
          </div>
          {orientation === "vertical" ? (
            <>
              <div className="flex-1 min-w-0 pt-0.5">
                <span className={labelVariants({ selected })}>{label}</span>
                {description && (
                  <span className="block text-xs text-muted-foreground truncate">
                    {description}
                  </span>
                )}
              </div>
              {showChevron && <SelectionChevron selected={selected} />}
            </>
          ) : (
            // Horizontal: label below icon, no description / chevron
            <span className={labelVariants({ selected })}>{label}</span>
          )}
        </>
      );

    // Polymorphic render. Spreading rest lets callers add data-* attrs.
    if (as === "a") {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={composedClassName}
          onClick={onClick}
          onKeyDown={onKeyDown}
          title={title}
          aria-label={ariaLabel}
          aria-current={ariaCurrent}
          data-tour={dataTour}
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {body}
        </a>
      );
    }

    if (as === "div") {
      return (
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={cn(composedClassName, "cursor-pointer")}
          onClick={onClick}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onClick?.(e as unknown as React.MouseEvent<HTMLElement>);
            }
            onKeyDown?.(e);
          }}
          title={title}
          aria-label={ariaLabel}
          aria-current={ariaCurrent}
          aria-disabled={disabled || undefined}
          data-tour={dataTour}
          {...(rest as React.HTMLAttributes<HTMLDivElement>)}
        >
          {body}
        </div>
      );
    }

    // Default: <button>
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={composedClassName}
        onClick={onClick}
        onKeyDown={onKeyDown}
        title={title}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        data-tour={dataTour}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {body}
      </button>
    );
  },
);

SelectionButton.displayName = "SelectionButton";
