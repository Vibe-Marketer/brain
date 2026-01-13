---
name: dev-browser
description: Browser automation with persistent page state. Use when users ask to navigate websites, fill forms, take screenshots, extract web data, test web apps, or automate browser workflows. Trigger phrases include "go to [url]", "click on", "fill out the form", "take a screenshot", "scrape", "automate", "test the website", "log into", or any browser interaction request.
---

# Dev Browser Skill

Browser automation that maintains page state across script executions. Write small, focused scripts to accomplish tasks incrementally.

## First-Time Setup

If dev-browser isn't installed yet, run:

```bash
# Create the directory
mkdir -p ~/.config/claude-code/dev-browser

# Clone or copy the dev-browser source
# Option 1: From a local copy
cp -r ralph/skills/dev-browser/* ~/.config/claude-code/dev-browser/

# Option 2: Install dependencies
cd ~/.config/claude-code/dev-browser && npm install
```

This only needs to be done once per machine.

## Starting the Browser Server

```bash
~/.config/claude-code/dev-browser/server.sh &
```

Wait for the `Ready` message before running scripts. Add `--headless` flag for headless mode.

**Key points:**
- Profile stored at `~/.config/claude-code/dev-browser/profiles/browser-data`
- Login sessions persist across browser restarts
- Use for local dev testing with auth (localhost:3000, etc.)

## Writing Scripts

Run all scripts from the dev-browser directory:

```bash
cd ~/.config/claude-code/dev-browser && npx tsx <<'EOF'
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect();
const page = await client.page("example");
await page.setViewportSize({ width: 1280, height: 800 });

await page.goto("https://example.com");
await waitForPageLoad(page);

console.log({ title: await page.title(), url: page.url() });
await client.disconnect();
EOF
```

### Key Principles

1. **Small scripts**: Each script does ONE thing (navigate, click, fill, check)
2. **Descriptive page names**: Use `"checkout"`, `"login"`, not `"main"`
3. **Disconnect to exit**: `await client.disconnect()` - pages persist on server
4. **Plain JS in evaluate**: `page.evaluate()` runs in browser - no TypeScript

## Client API

```typescript
const client = await connect();
const page = await client.page("name");     // Get or create named page
const pages = await client.list();          // List all page names
await client.close("name");                 // Close a page
await client.disconnect();                  // Disconnect (pages persist)

// ARIA Snapshot methods
const snapshot = await client.getAISnapshot("name");
const element = await client.selectSnapshotRef("name", "e5");

// Token-efficient content extraction
const outline = await client.getOutline("name");
const interactive = await client.getInteractiveOutline("name");
const text = await client.getVisibleText("name");
```

## Content Extraction Methods

| Method | Use case | Efficiency |
|--------|----------|------------|
| `getInteractiveOutline()` | Discover clickable elements | Best |
| `getOutline()` | Understand page structure | Good |
| `getVisibleText()` | Extract readable content | Good |
| `getAISnapshot()` | Need ref-based clicking | OK |
| `screenshot()` | Visual debugging | Uses vision |

## Screenshots

```typescript
await page.screenshot({ path: "tmp/screenshot.png" });
await page.screenshot({ path: "tmp/full.png", fullPage: true });
```

## Waiting

```typescript
import { waitForPageLoad } from "@/client.js";

await waitForPageLoad(page);              // After navigation
await page.waitForSelector(".results");   // For specific elements
await page.waitForURL("**/success");      // For specific URL
```

## Error Recovery

Page state persists after failures. Debug with:

```bash
cd ~/.config/claude-code/dev-browser && npx tsx <<'EOF'
import { connect } from "@/client.js";

const client = await connect();
const page = await client.page("debug");

await page.screenshot({ path: "tmp/debug.png" });
console.log({
  url: page.url(),
  title: await page.title(),
});

await client.disconnect();
EOF
```

## Clearing Cache

To clear browser profile data:
```bash
rm -rf ~/.config/claude-code/dev-browser/profiles/
```

To clear temp files:
```bash
rm -rf ~/.config/claude-code/dev-browser/tmp/
```
