import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";
import tailwindcssAnimate from "tailwindcss-animate";
import headlessuiTailwindcss from "@headlessui/tailwindcss";
import tailwindcssForms from "@tailwindcss/forms";

// Tailwind deprecated these color aliases in v3. Accessing them (even via destructuring)
// triggers console warnings. Using Object.keys + filter avoids accessing the deprecated getters.
const deprecatedColors = new Set(['lightBlue', 'warmGray', 'trueGray', 'coolGray', 'blueGray']);
const tailwindColors = Object.keys(colors)
  .filter(key => !deprecatedColors.has(key))
  .reduce((acc, key) => {
    acc[key] = (colors as unknown as Record<string, unknown>)[key];
    return acc;
  }, {} as Record<string, unknown>);

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        /**
         * CallVault Semantic Color System
         * Use these classes directly (e.g., text-ink, bg-hover, border-soft).
         * For full documentation, see: docs/design/brand-guidelines-v4.2.md
         */
        ink: {
          DEFAULT: "hsl(var(--ink))",
          soft: "hsl(var(--ink-soft))",
          muted: "hsl(var(--ink-muted))",
        },
        border: {
          DEFAULT: "hsl(var(--border-color))",
          soft: "hsl(var(--border-soft))",
        },
        hover: "hsl(var(--hover-bg))",
        gray: {
          light: "hsl(var(--cb-gray-light))",
          medium: "hsl(var(--cb-gray-medium))",
          dark: "hsl(var(--cb-gray-dark))",
        },
        viewport: "hsl(var(--viewport))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          light: "hsl(var(--primary-light))",
          dark: "hsl(var(--primary-dark))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          dark: "hsl(var(--secondary-dark))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          blue: "hsl(var(--accent-blue))",
          green: "hsl(var(--accent-green))",
          orange: "hsl(var(--accent-orange))",
          red: "hsl(var(--accent-red))",
          purple: "hsl(var(--accent-purple))",
          yellow: "hsl(var(--accent-yellow))",
        },
        purple: {
          DEFAULT: "hsl(var(--vibe-purple))",
          light: "hsl(var(--vibe-purple-light))",
          dark: "hsl(var(--vibe-purple-dark))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          bg: "hsl(var(--success-bg))",
          text: "hsl(var(--success-text))",
          border: "hsl(var(--success-border))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          bg: "hsl(var(--warning-bg))",
          text: "hsl(var(--warning-text))",
          border: "hsl(var(--warning-border))",
        },
        error: {
          DEFAULT: "hsl(var(--destructive))",
          bg: "hsl(var(--danger-bg))",
          text: "hsl(var(--danger-text))",
          border: "hsl(var(--danger-border))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          bg: "hsl(var(--info-bg))",
          text: "hsl(var(--info-text))",
          border: "hsl(var(--info-border))",
        },
        surface: {
          primary: "hsl(var(--surface-primary))",
          secondary: "hsl(var(--surface-secondary))",
          tertiary: "hsl(var(--surface-tertiary))",
        },
        intel: {
          deal: "hsl(var(--intel-deal))",
          risk: "hsl(var(--intel-risk))",
          product: "hsl(var(--intel-product))",
          competitive: "hsl(var(--intel-competitive))",
          action: "hsl(var(--intel-action))",
        },
        /**
         * Backwards-compatible cb- aliases
         * Points to unprefixed CSS variables - will be removed in future version
         */
        cb: {
          black: "hsl(var(--black))",
          white: "hsl(var(--white))",
          "gray-light": "hsl(var(--cb-gray-light))",
          "gray-medium": "hsl(var(--cb-gray-medium))",
          "gray-dark": "hsl(var(--cb-gray-dark))",
          ink: "hsl(var(--ink))",
          "ink-soft": "hsl(var(--ink-soft))",
          "ink-muted": "hsl(var(--ink-muted))",
          border: "hsl(var(--border-color))",
          "border-soft": "hsl(var(--border-soft))",
          "border-dark": "hsl(var(--border-dark))",
          hover: "hsl(var(--hover-bg))",
          "hover-dark": "hsl(var(--panel-dark))",
          "panel-dark": "hsl(var(--panel-dark))",
          card: "hsl(var(--card))",
          "card-dark": "hsl(var(--card-dark))",
          viewport: "hsl(var(--viewport))",
          "viewport-dark": "hsl(var(--viewport-dark))",
          "text-dark-primary": "hsl(var(--text-dark-primary))",
          "text-dark-secondary": "hsl(var(--text-dark-secondary))",
          "success-bg": "hsl(var(--success-bg))",
          "success-text": "hsl(var(--success-text))",
          "success-border": "hsl(var(--success-border))",
          "warning-bg": "hsl(var(--warning-bg))",
          "warning-text": "hsl(var(--warning-text))",
          "warning-border": "hsl(var(--warning-border))",
          "danger-bg": "hsl(var(--danger-bg))",
          "danger-text": "hsl(var(--danger-text))",
          "danger-border": "hsl(var(--danger-border))",
          "info-bg": "hsl(var(--info-bg))",
          "info-text": "hsl(var(--info-text))",
          "info-border": "hsl(var(--info-border))",
          "neutral-bg": "hsl(var(--neutral-bg))",
          "neutral-text": "hsl(var(--neutral-text))",
          "neutral-border": "hsl(var(--neutral-border))",
        },
        "vibe-orange": {
          DEFAULT: "hsl(var(--vibe-orange))",
          light: "hsl(var(--vibe-orange-light))",
          dark: "hsl(var(--vibe-orange-dark))",
        },
        "vibe-green": {
          DEFAULT: "hsl(var(--vibe-orange))",
          light: "hsl(var(--vibe-orange-light))",
          dark: "hsl(var(--vibe-orange-dark))",
        },
        tremor: {
          brand: {
            faint: "hsl(32, 100%, 95%)",
            muted: "hsl(32, 100%, 85%)",
            subtle: "hsl(32, 100%, 70%)",
            DEFAULT: "hsl(32, 100%, 50%)",
            emphasis: "hsl(14, 100%, 50%)",
            inverted: colors.white,
          },
          background: {
            muted: "hsl(0, 0%, 98%)",
            subtle: "hsl(0, 0%, 96%)",
            DEFAULT: "hsl(0, 0%, 100%)",
            emphasis: "hsl(0, 0%, 27%)",
          },
          border: { DEFAULT: "hsl(0, 0%, 90%)" },
          ring: { DEFAULT: "hsl(0, 0%, 90%)" },
          content: {
            subtle: "hsl(0, 0%, 60%)",
            DEFAULT: "hsl(0, 0%, 48%)",
            emphasis: "hsl(0, 0%, 27%)",
            strong: "hsl(0, 0%, 7%)",
            inverted: "hsl(0, 0%, 100%)",
          },
        },
        "dark-tremor": {
          brand: {
            faint: "hsl(32, 50%, 15%)",
            muted: "hsl(32, 60%, 25%)",
            subtle: "hsl(32, 70%, 50%)",
            DEFAULT: "hsl(32, 100%, 50%)",
            emphasis: "hsl(55, 100%, 50%)",
            inverted: "hsl(32, 50%, 15%)",
          },
          background: {
            muted: "hsl(0, 0%, 9%)",
            subtle: "hsl(0, 0%, 13%)",
            DEFAULT: "hsl(0, 0%, 13%)",
            emphasis: "hsl(0, 0%, 98%)",
          },
          border: { DEFAULT: "hsl(0, 0%, 23%)" },
          ring: { DEFAULT: "hsl(0, 0%, 23%)" },
          content: {
            subtle: "hsl(0, 0%, 42%)",
            DEFAULT: "hsl(0, 0%, 69%)",
            emphasis: "hsl(0, 0%, 98%)",
            strong: "hsl(0, 0%, 100%)",
            inverted: "hsl(0, 0%, 9%)",
          },
        },
        colors: {
          ...tailwindColors,
          orange: {
            50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa',
            300: '#FFEB00', 400: '#FF8800', 500: '#FF8800',
            600: '#FF3D00', 700: '#c2410c', 800: '#9a3412',
            900: '#7c2d12', 950: '#431407',
          },
        },
      },
      boxShadow: {
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "dark-tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "dark-tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "dark-tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        hide: { from: { opacity: "1" }, to: { opacity: "0" } },
        slideDownAndFade: { from: { opacity: "0", transform: "translateY(-6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideLeftAndFade: { from: { opacity: "0", transform: "translateX(6px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        slideUpAndFade: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideRightAndFade: { from: { opacity: "0", transform: "translateX(-6px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        accordionOpen: { from: { height: "0px" }, to: { height: "var(--radix-accordion-content-height)" } },
        accordionClose: { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0px" } },
        dialogOverlayShow: { from: { opacity: "0" }, to: { opacity: "1" } },
        dialogContentShow: { from: { opacity: "0", transform: "translate(-50%, -45%) scale(0.95)" }, to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        hide: "hide 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideDownAndFade: "slideDownAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideLeftAndFade: "slideLeftAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideUpAndFade: "slideUpAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideRightAndFade: "slideRightAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        accordionOpen: "accordionOpen 150ms cubic-bezier(0.87, 0, 0.13, 1)",
        accordionClose: "accordionClose 150ms cubic-bezier(0.87, 0, 0.13, 1)",
        dialogOverlayShow: "dialogOverlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        dialogContentShow: "dialogContentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  safelist: [
    { pattern: /^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/, variants: ["hover", "ui-selected"] },
    { pattern: /^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/, variants: ["hover", "ui-selected"] },
    { pattern: /^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/, variants: ["hover", "ui-selected"] },
    { pattern: /^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/ },
    { pattern: /^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/ },
    { pattern: /^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/ },
  ],
  plugins: [tailwindcssAnimate, headlessuiTailwindcss, tailwindcssForms],
} as Config;
