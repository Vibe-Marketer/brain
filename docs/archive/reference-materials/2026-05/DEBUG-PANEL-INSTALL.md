# Debug Panel - Installation Guide

> **"Sentry-in-a-Box"** - A self-contained, zero-dependency debug panel that captures errors, warnings, network issues, and user actions with localStorage persistence and AI-optimized Markdown export.

**No paid services required. No external dependencies. Just copy, paste, and go.**

---

## Table of Contents

1. [Quick Start (5 Minutes)](#quick-start-5-minutes)
2. [What You Get](#what-you-get)
3. [File Structure](#file-structure)
4. [Step-by-Step Installation](#step-by-step-installation)
5. [Configuration Options](#configuration-options)
6. [Usage Examples](#usage-examples)
7. [Exporting Bug Reports](#exporting-bug-reports)
8. [Advanced Features](#advanced-features)
9. [Customization](#customization)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start (5 Minutes)

### Step 1: Copy the folder

```bash
# Copy the entire debug-panel folder to your project
cp -r path/to/debug-panel your-project/src/components/
```

### Step 2: Install the ONE required dependency

```bash
npm install @remixicon/react
# OR
pnpm add @remixicon/react
# OR
yarn add @remixicon/react
```

> **That's the only dependency!** Everything else is self-contained.

### Step 3: Wrap your app

```tsx
// In your App.tsx or root layout
import { DebugPanelProvider } from '@/components/debug-panel';

function App() {
  return (
    <DebugPanelProvider>
      {/* Your app content */}
    </DebugPanelProvider>
  );
}
```

### Step 4: Add the panel UI

```tsx
// In your layout (usually only in development)
import { DebugPanel } from '@/components/debug-panel';

function Layout({ children }) {
  return (
    <>
      {children}
      {import.meta.env.DEV && <DebugPanel />}
    </>
  );
}
```

### Step 5: You're done!

Click the bug icon in the bottom-right corner to see captured errors.

---

## What You Get

### Automatic Error Capture

| What's Captured | How | Logged As |
|-----------------|-----|-----------|
| JavaScript exceptions | `window.onerror` | Error |
| Unhandled Promise rejections | `unhandledrejection` | Error |
| `console.error()` calls | Intercepted | Error |
| `console.warn()` calls | Intercepted | Warning |
| HTTP 5xx server errors | Fetch interceptor | Error |
| HTTP 4xx client errors | Fetch interceptor | Warning |
| Network failures | Fetch catch | Error |
| Failed resources (img/script/css) | Error event (capture) | Error |

### Performance Monitoring

| What's Detected | Threshold | Logged As |
|-----------------|-----------|-----------|
| Slow API requests | > 3 seconds | Warning |
| Large response payloads | > 1 MB | Warning |
| Long tasks (main thread blocking) | > 50ms | Warning |
| Rapid state changes (infinite loops) | > 20 changes in 500ms | Warning |

### User Journey Tracking (Action Trail)

| What's Tracked | How | Example |
|----------------|-----|---------|
| Page loads | Automatic | `Page loaded: /dashboard` |
| Navigation | `popstate` event | `Navigated to /settings` |
| Button clicks | Click listener | `Clicked button: "Save"` |
| Link clicks | Click listener | `Clicked a: "Home"` |
| API calls | Fetch interceptor | `POST /api/users` |

### Key Features

- ✅ **localStorage Persistence** - Messages survive page refresh
- ✅ **Performance Tracking** - Detect slow APIs, large payloads, long tasks
- ✅ **Resource Monitoring** - Track failed images, scripts, stylesheets
- ✅ **Markdown Export** - Copy AI-optimized bug reports with one click
- ✅ **Error Acknowledgment** - Badge only shows unread errors
- ✅ **Bookmarking** - Mark important errors for later
- ✅ **Search & Filter** - Find specific errors quickly
- ✅ **Timeline View** - See errors in chronological context
- ✅ **Analytics View** - Error rates, patterns, and stats
- ✅ **Infinite Loop Detection** - Catches rapid state changes

---

## File Structure

```
debug-panel/
├── index.ts                    # Barrel exports (import from here)
├── types.ts                    # TypeScript interfaces
├── DebugPanelContext.tsx       # React context + all tracking logic
├── DebugPanel.tsx              # The UI component
├── debug-dump-utils.ts         # Markdown/JSON export utilities
└── DEBUG-PANEL-INSTALL.md      # This file
```

**Total: 6 files, ~2000 lines of code, fully self-contained.**

---

## Step-by-Step Installation

### Prerequisites

- React 18+ (hooks-based)
- TypeScript (optional but recommended)
- Tailwind CSS (for styling)

### Detailed Steps

#### 1. Copy Files

Copy the entire `debug-panel/` folder into your `src/components/` directory:

```
your-project/
└── src/
    └── components/
        └── debug-panel/    ← Copy here
            ├── index.ts
            ├── types.ts
            ├── DebugPanelContext.tsx
            ├── DebugPanel.tsx
            └── debug-dump-utils.ts
```

#### 2. Install Remix Icons

The panel uses [Remix Icon](https://remixicon.com/) for icons. Install it:

```bash
npm install @remixicon/react
```

#### 3. Check Import Paths

The panel imports from `@/components/ui/button`. If your project uses a different path:

**Option A:** Create an alias (recommended)
```ts
// tsconfig.json or vite.config.ts
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

**Option B:** Update imports in `DebugPanel.tsx`
```tsx
// Change this:
import { Button } from '@/components/ui/button';

// To your path:
import { Button } from 'your/path/to/button';
```

#### 4. Optional: Screenshot Support

For full screenshot capture with "Download Full", you can optionally install:

```bash
npm install html2canvas-pro
```

If not installed, everything still works - you just won't get screenshots in the full dump.

#### 5. Wrap Your App

```tsx
// src/App.tsx or src/main.tsx
import { DebugPanelProvider } from '@/components/debug-panel';

export default function App() {
  return (
    <DebugPanelProvider>
      <YourRouterOrContent />
    </DebugPanelProvider>
  );
}
```

#### 6. Add the Panel Component

```tsx
// In your root layout
import { DebugPanel } from '@/components/debug-panel';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}

        {/* Show debug panel in development */}
        {process.env.NODE_ENV === 'development' && <DebugPanel />}

        {/* OR: Show for admins only */}
        {/* {isAdmin && <DebugPanel />} */}
      </body>
    </html>
  );
}
```

#### 7. Verify It Works

1. Start your dev server
2. Look for a bug icon (🐛) in the bottom-right corner
3. Open browser console and type: `console.error('Test error')`
4. Click the bug icon - you should see your test error!

---

## Configuration Options

### Basic Configuration

```tsx
<DebugPanelProvider config={{
  maxMessages: 500,           // Max messages in memory (default: 500)
  maxActions: 50,             // Max action trail entries (default: 50)
  persistMessages: true,      // Save to localStorage (default: true)
  persistedMessageLimit: 100, // Max messages saved to storage (default: 100)
}}>
```

### HTTP Error Tracking

```tsx
<DebugPanelProvider config={{
  trackHttpErrors: true,      // Track 4xx/5xx errors (default: true)
  track4xxAsWarnings: true,   // Log 4xx as warnings (default: true)
                              // Set to false to log 4xx as errors
}}>
```

### Disable Persistence

If you don't want errors saved to localStorage:

```tsx
<DebugPanelProvider config={{
  persistMessages: false,
}}>
```

### Full Configuration Reference

```tsx
interface DebugPanelConfig {
  // Core settings
  maxMessages?: number;           // Max messages in memory (default: 500)
  maxActions?: number;            // Max action trail entries (default: 50)
  persistMessages?: boolean;      // Save to localStorage (default: true)
  persistedMessageLimit?: number; // Max persisted messages (default: 100)

  // HTTP tracking
  trackHttpErrors?: boolean;      // Track HTTP errors (default: true)
  track4xxAsWarnings?: boolean;   // 4xx as warnings vs errors (default: true)

  // Performance monitoring
  trackSlowRequests?: boolean;    // Warn on slow API calls (default: true)
  slowRequestThreshold?: number;  // Threshold in ms (default: 3000)
  trackLargePayloads?: boolean;   // Warn on large responses (default: true)
  largePayloadThreshold?: number; // Threshold in bytes (default: 1048576 = 1MB)
  trackLongTasks?: boolean;       // Detect main thread blocking (default: true)
  longTaskThreshold?: number;     // Threshold in ms (default: 50)
  trackResourceErrors?: boolean;  // Track failed images/scripts/CSS (default: true)

  // State tracking
  rapidStateThreshold?: number;   // State changes for loop detection (default: 20)
  rapidStateWindow?: number;      // Time window in ms (default: 500)
}
```

---

## Usage Examples

### Manual Logging (Inside React Components)

```tsx
import { useDebugPanel } from '@/components/debug-panel';

function MyComponent() {
  const { addMessage, logAction } = useDebugPanel();

  const handleSubmit = async () => {
    // Log a custom info message
    addMessage({
      type: 'info',
      message: 'User submitted form',
      category: 'ui',
    });

    // Log a user action
    logAction('user_input', 'Submitted contact form', 'email: user@example.com');

    try {
      await submitForm();
    } catch (error) {
      // Log errors manually with extra context
      addMessage({
        type: 'error',
        message: error.message,
        category: 'api',
        details: JSON.stringify(error),
        stack: error.stack,
      });
    }
  };
}
```

### Global Logging (Outside React)

For logging from services, utilities, or anywhere outside React:

```tsx
// First, set up the global logger (in your App or root component)
import { useDebugPanel, setGlobalDebugLogger } from '@/components/debug-panel';

function App() {
  const { addMessage, logAction, logWebSocket } = useDebugPanel();

  useEffect(() => {
    setGlobalDebugLogger(addMessage, logAction, logWebSocket);
  }, [addMessage, logAction, logWebSocket]);

  return <YourApp />;
}

// Then use anywhere in your app:
import { debugLog, debugAction } from '@/components/debug-panel';

// In a service file:
export async function fetchUserData(userId: string) {
  debugAction('api_call', `Fetching user ${userId}`);

  try {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  } catch (error) {
    debugLog('error', `Failed to fetch user: ${error.message}`, {
      category: 'api',
      details: `User ID: ${userId}`,
    });
    throw error;
  }
}
```

### WebSocket Event Logging

```tsx
import { useDebugPanel } from '@/components/debug-panel';

function useWebSocket(url: string) {
  const { logWebSocket } = useDebugPanel();

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      logWebSocket('connection_opened', { url }, 'connection');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      logWebSocket(data.type, data); // Auto-categorizes based on message type
    };

    ws.onerror = () => {
      logWebSocket('connection_error', { url }, 'connection');
    };

    ws.onclose = (event) => {
      logWebSocket('connection_closed', { code: event.code }, 'connection');
    };

    return () => ws.close();
  }, [url, logWebSocket]);
}
```

---

## Exporting Bug Reports

### Copy as Markdown (For AI Tools)

Click **"Copy Report"** to get an AI-optimized Markdown report:

```markdown
# Bug Report

> **Context for AI:** This is a structured bug report from the debug panel.
> Analyze the errors below, identify root causes, and suggest specific fixes.

---

**Generated:** 2024-12-07T15:30:00.000Z
**URL:** https://myapp.com/dashboard
**Environment:** Chrome 120 on macOS (1440x900)

## Summary
| Metric | Value |
|--------|-------|
| Total Messages | 15 |
| Errors | 3 |
| Warnings | 7 |
| Unique Issues | 2 |
| Time Span | 5 minutes |

**Top Issue:** error: HTTP 500: Internal Server Error (2x)

## User Journey (Before Errors)
- `15:25:30` 🧭 **navigation**: Page loaded: /dashboard
- `15:25:35` 👆 **click**: Clicked button: "Load Data"
- `15:25:36` 🔗 **api_call**: GET /api/dashboard
- `15:25:37` 👆 **click**: Clicked button: "Refresh"

## Error Groups

### 🔴 HTTP 500: Internal Server Error
- **Type:** error
- **Count:** 2
- **Category:** network
- **First Seen:** 2024-12-07T15:25:36.000Z
- **Sources:** network

**Details:**
URL: /api/dashboard
Method: GET
```

### Download Full JSON

Click **"Download Full"** to get the complete dump including:
- All messages with full metadata
- Screenshots (if `html2canvas-pro` is installed)
- Complete action trail
- App state and environment info

---

## Advanced Features

### Rapid State Change Detection

Detect infinite render loops in your components:

```tsx
import { useStateTracker } from '@/components/debug-panel';

function ProblematicComponent() {
  const [count, setCount] = useState(0);
  const trackState = useStateTracker('ProblematicComponent');

  useEffect(() => {
    trackState('count', count);  // Warns if count changes >20x in 500ms
    setCount(c => c + 1);        // This would trigger a warning!
  }, [count, trackState]);

  return <div>{count}</div>;
}
```

When detected, you'll see:
```
[RAPID STATE] ProblematicComponent.count changed 23 times in 500ms
Possible infinite loop detected
```

### SPA Navigation Tracking

Track React Router navigation (beyond just `popstate`):

```tsx
import { useNavigationTracker } from '@/components/debug-panel';

function App() {
  useNavigationTracker();  // Uses MutationObserver to detect route changes

  return (
    <Router>
      <Routes>
        {/* your routes */}
      </Routes>
    </Router>
  );
}
```

---

## Customization

### Styling

The panel uses Tailwind CSS. To customize:

**Move the toggle button:**
```tsx
// In DebugPanel.tsx, find:
className="fixed bottom-6 right-6 ..."

// Change to:
className="fixed bottom-6 left-6 ..."  // Move to left
```

**Change panel width:**
```tsx
// Find:
className={`... ${isMaximized ? 'w-[80vw]' : 'w-[500px]'} ...`}

// Change to:
className={`... ${isMaximized ? 'w-[90vw]' : 'w-[600px]'} ...`}
```

### Replace Remix Icons

If you use a different icon library, update `DebugPanel.tsx`:

```tsx
// Change:
import { RiBugLine, RiCloseLine, ... } from '@remixicon/react';

// To your library:
import { Bug, X, ... } from 'lucide-react';

// Then update the JSX:
<RiBugLine className="w-5 h-5" />
// becomes:
<Bug className="w-5 h-5" />
```

### Admin-Only Access

The default `DebugPanel.tsx` uses a `useUserRole` hook. Replace with your auth logic:

```tsx
// Find:
const { isAdmin, loading: roleLoading } = useUserRole();
if (roleLoading || !isAdmin) return null;

// Replace with your logic:
const { user } = useAuth();
if (!user?.isAdmin) return null;

// Or remove the check entirely for always-visible panel
```

---

## Troubleshooting

### "useDebugPanel must be used within DebugPanelProvider"

**Problem:** You're using `useDebugPanel()` outside of the provider.

**Solution:** Make sure `DebugPanelProvider` wraps your entire app:

```tsx
// ❌ Wrong
function App() {
  const { addMessage } = useDebugPanel(); // Error!
  return <DebugPanelProvider>...</DebugPanelProvider>;
}

// ✅ Correct
function App() {
  return (
    <DebugPanelProvider>
      <AppContent />  {/* useDebugPanel works here */}
    </DebugPanelProvider>
  );
}
```

### Messages Not Persisting After Refresh

**Check:**
1. `persistMessages: true` in config (it's true by default)
2. Not in private/incognito mode
3. localStorage isn't full (check browser console for quota errors)

### Too Many Warnings from 4xx Errors

**Solution:** Disable 4xx tracking or change to errors:

```tsx
<DebugPanelProvider config={{
  track4xxAsWarnings: false,  // Don't log 4xx at all
  // OR
  trackHttpErrors: false,     // Don't track any HTTP errors
}}>
```

### Panel Not Showing

**Check:**
1. Is `<DebugPanel />` actually rendered? (Check conditional logic)
2. Is it hidden behind another element? (Check z-index)
3. Are you checking for admin role? (Temporarily remove the check)

### TypeScript Errors

**"Cannot find module '@/components/debug-panel'"**

Add path alias to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Storage Keys

The panel uses these localStorage/sessionStorage keys:

| Key | Storage | Purpose |
|-----|---------|---------|
| `debug_panel_messages` | localStorage | Persisted error messages |
| `debug_panel_action_trail` | localStorage | User action history |
| `debug_panel_session_id` | sessionStorage | Current session identifier |

To clear all debug data:
```ts
localStorage.removeItem('debug_panel_messages');
localStorage.removeItem('debug_panel_action_trail');
sessionStorage.removeItem('debug_panel_session_id');
```

Or click the trash icon in the panel header.

---

## FAQ

**Q: Does this send data anywhere?**
A: No. Everything stays in your browser's localStorage. Nothing is sent to external servers.

**Q: Can I use this in production?**
A: Yes, but consider showing it only to admins or in a hidden debug mode.

**Q: Does it work with Next.js/Remix/etc?**
A: Yes, it's framework-agnostic. Just wrap your app with the provider.

**Q: What about React Native?**
A: Not currently supported (uses browser APIs like localStorage and fetch interception).

---

## License

MIT - Use freely in any project.

---

**Questions?** Open an issue or check the source code - it's well-commented!
