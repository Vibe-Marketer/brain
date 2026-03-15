# Public Assets

Place static assets here. Mintlify serves this directory at the root of the docs site.

## Required logo files

Add the following SVG files to `docs-site/public/logo/`:

- `callvault-light.svg` — logo for light mode backgrounds (typically dark text/icon)
- `callvault-dark.svg` — logo for dark mode backgrounds (typically light text/icon)

These are referenced in `mint.json` as `/logo/callvault-light.svg` and `/logo/callvault-dark.svg`.

## Favicon

Place `favicon.ico` directly in this directory (`docs-site/public/favicon.ico`).

## Other assets

You can place any other static files (images, downloadable files, etc.) here and reference them
in MDX pages with absolute paths, e.g. `/images/screenshot.png`.
