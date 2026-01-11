# Pane System Guide

The CallVault pane system provides a flexible, non-overlay approach to displaying supplementary content alongside the main view. It supports two-pane and three-pane layouts with smooth CSS Grid transitions.

## Core Principles

- **Non-Overlay**: Panes push content aside rather than overlaying it
- **Smooth Transitions**: 350ms cubic-bezier animations for all layout changes
- **Consistent Width**: Side panes are always 380px wide
- **Z-Index Hierarchy**: Right pane (z-index: 20) > Left pane (z-index: 10) > Main content (z-index: 1)

## Design Tokens

```typescript
import { PANE_SYSTEM } from '@/lib/design-tokens';

PANE_SYSTEM = {
  splitPaneWidth: "380px",      // Fixed width for side panes
  animationDuration: "350ms",   // Transition duration
  animationEasing: "cubic-bezier(0.4, 0, 0.2, 1)",
  zIndex: {
    base: 1,                    // Main content
    leftPane: 10,               // Left side pane
    rightPane: 20,              // Right side pane
    floatingWindow: 9999,       // Floating overlays
  }
}
```

---

## Two-Pane Configuration

### Configuration 1: Main Content + Right Pane

**Use Case**: Detail views, filters, properties panels

**Layout Behavior**:

- Initial: Main content spans full width (`1fr`)
- With right pane: `1fr 380px` (main shrinks to accommodate pane)

**Example: Call Detail View**

```tsx
import { PaneSystem } from '@/components/ui/pane-system';
import { usePaneContext } from '@/contexts/PaneContext';

function CallsPage() {
  const { rightPaneOpen, setRightPaneOpen } = usePaneContext();
  const [selectedCall, setSelectedCall] = useState(null);

  const handleCallClick = (call) => {
    setSelectedCall(call);
    setRightPaneOpen(true);
  };

  return (
    <PaneSystem
      rightPaneOpen={rightPaneOpen}
      rightPane={
        selectedCall && (
          <CallDetailPanel 
            call={selectedCall}
            onClose={() => setRightPaneOpen(false)}
          />
        )
      }
    >
      {/* Main Content */}
      <div className="space-y-4">
        <h1>Call Library</h1>
        <CallsTable onCallClick={handleCallClick} />
      </div>
    </PaneSystem>
  );
}
```

**Visual Flow**:

```
┌─────────────────────────────────────┐
│                                     │
│         Main Content                │
│         (Full Width)                │
│                                     │
└─────────────────────────────────────┘

              ↓ User clicks call

┌────────────────────────┬───────────┐
│                        │           │
│    Main Content        │   Right   │
│    (Shrinks)           │   Pane    │
│                        │  (380px)  │
└────────────────────────┴───────────┘
```

### Configuration 2: Left Pane + Main Content

**Use Case**: Navigation trees, filters sidebar

**Layout Behavior**:

- Initial: Main content spans full width (`1fr`)
- With left pane: `380px 1fr` (main shifts right)

**Example: Agent Configuration**

```tsx
function AgentBuilder() {
  const { leftPaneOpen, setLeftPaneOpen } = usePaneContext();

  return (
    <PaneSystem
      leftPaneOpen={leftPaneOpen}
      leftPane={
        <AgentTemplateLibrary 
          onSelectTemplate={(template) => {/* apply template */}}
        />
      }
    >
      {/* Main Content */}
      <div className="space-y-6">
        <Button onClick={() => setLeftPaneOpen(!leftPaneOpen)}>
          {leftPaneOpen ? 'Hide' : 'Show'} Templates
        </Button>
        <AgentConfigForm />
      </div>
    </PaneSystem>
  );
}
```

---

## Three-Pane Configuration

### Configuration: Left Pane + Main Content + Right Pane

**Use Case**: Advanced workflows, multi-context views

**Layout Behavior**:

- Initial: Main content spans full width (`1fr`)
- Left only: `380px 1fr`
- Right only: `1fr 380px`
- Both: `380px 1fr 380px` (main content centered between two panes)

**Example: Intel Analysis Workspace**

```tsx
function IntelWorkspace() {
  const { 
    leftPaneOpen, 
    rightPaneOpen, 
    setLeftPaneOpen, 
    setRightPaneOpen 
  } = usePaneContext();
  
  const [selectedIntel, setSelectedIntel] = useState(null);

  return (
    <PaneSystem
      leftPaneOpen={leftPaneOpen}
      rightPaneOpen={rightPaneOpen}
      leftPane={
        <IntelFilters 
          onFilterChange={(filters) => {/* apply filters */}}
        />
      }
      rightPane={
        selectedIntel && (
          <IntelDetailView 
            intel={selectedIntel}
            onClose={() => setRightPaneOpen(false)}
          />
        )
      }
    >
      {/* Main Content */}
      <div className="space-y-4">
        <div className="flex justify-between">
          <Button 
            variant="outline"
            onClick={() => setLeftPaneOpen(!leftPaneOpen)}
          >
            {leftPaneOpen ? '✕' : '☰'} Filters
          </Button>
          
          <h1>Intel Feed</h1>
        </div>
        
        <IntelGrid 
          onIntelClick={(intel) => {
            setSelectedIntel(intel);
            setRightPaneOpen(true);
          }}
        />
      </div>
    </PaneSystem>
  );
}
```

**Visual Flow**:

```
┌─────────────────────────────────────┐
│                                     │
│         Main Content                │
│         (Full Width)                │
│                                     │
└─────────────────────────────────────┘

         ↓ User opens left filters

┌──────────┬──────────────────────────┐
│          │                          │
│   Left   │      Main Content        │
│   Pane   │      (Shrinks)           │
│ (380px)  │                          │
└──────────┴──────────────────────────┘

    ↓ User clicks intel item (right pane opens)

┌──────────┬──────────────┬──────────┐
│          │              │          │
│   Left   │     Main     │  Right   │
│   Pane   │   Content    │  Pane    │
│ (380px)  │  (Flexible)  │ (380px)  │
└──────────┴──────────────┴──────────┘

    ↓ User closes left pane (main expands)

┌────────────────────────┬──────────┐
│                        │          │
│    Main Content        │  Right   │
│    (Expands)           │  Pane    │
│                        │ (380px)  │
└────────────────────────┴──────────┘
```

---

## Implementation Best Practices

### 1. State Management

Always use the PaneContext for pane state:

```tsx
import { usePaneContext } from '@/contexts/PaneContext';

function MyComponent() {
  const { 
    leftPaneOpen, 
    rightPaneOpen,
    setLeftPaneOpen, 
    setRightPaneOpen 
  } = usePaneContext();
  
  // Use these to control panes
}
```

### 2. Close Buttons

Always provide clear close affordances in panes:

```tsx
<aside className="p-6">
  <div className="flex justify-between items-center mb-4">
    <h2>Pane Title</h2>
    <Button 
      variant="ghost" 
      size="sm"
      onClick={() => setRightPaneOpen(false)}
    >
      ✕
    </Button>
  </div>
  {/* Pane content */}
</aside>
```

### 3. Responsive Behavior

On mobile/tablet, consider collapsing panes into modals:

```tsx
const isMobile = useMediaQuery('(max-width: 768px)');

return isMobile ? (
  <Dialog open={rightPaneOpen} onOpenChange={setRightPaneOpen}>
    <DialogContent>{/* Pane content */}</DialogContent>
  </Dialog>
) : (
  <PaneSystem rightPaneOpen={rightPaneOpen} rightPane={/* ... */}>
    {/* Main content */}
  </PaneSystem>
);
```

### 4. Animation Coordination

The grid transition is automatic, but coordinate content animations:

```tsx
<aside className={cn(
  "transition-opacity duration-350",
  rightPaneOpen ? "opacity-100" : "opacity-0"
)}>
  {/* Pane content fades in/out with slide */}
</aside>
```

### 5. Z-Index Awareness

Right panes have higher z-index (20) than left panes (10):

```tsx
// Right pane content can overlap left pane if needed
// Left pane content stays behind right pane
```

---

## Common Patterns

### Pattern: Master-Detail

Main list/grid with detail pane on right:

```tsx
<PaneSystem rightPaneOpen={!!selectedItem} rightPane={<Details item={selectedItem} />}>
  <ItemGrid onItemClick={setSelectedItem} />
</PaneSystem>
```

### Pattern: Filter-Content-Detail

Full three-pane workflow:

```tsx
<PaneSystem
  leftPaneOpen={showFilters}
  rightPaneOpen={!!selectedItem}
  leftPane={<Filters />}
  rightPane={<Details />}
>
  <ContentGrid />
</PaneSystem>
```

### Pattern: Contextual Tools

Toggle-able tool panels:

```tsx
<PaneSystem
  leftPaneOpen={activeToolPanel === 'templates'}
  leftPane={<TemplateLibrary />}
>
  <Editor />
</PaneSystem>
```

---

## Styling Guidelines

### Pane Container

```tsx
<aside className="bg-white dark:bg-[#202020] rounded-2xl p-6 shadow-sm overflow-auto">
  {/* Always use these base styles for consistency */}
</aside>
```

### Scrollable Content

```tsx
<div className="space-y-4 overflow-y-auto max-h-full">
  {/* Content that may exceed pane height */}
</div>
```

### Section Headers

```tsx
<div className="sticky top-0 bg-white dark:bg-[#202020] pb-4 border-b">
  <h3 className="font-display uppercase tracking-wide text-sm">Section</h3>
</div>
```

---

## Troubleshooting

**Issue**: Pane content jumps or flickers during transition

- **Solution**: Ensure pane content has consistent dimensions and avoid layout shifts

**Issue**: Main content text reflows awkwardly

- **Solution**: Use `min-width: 0` on flex/grid children to prevent overflow

**Issue**: Panes don't close properly

- **Solution**: Always tie pane state to data presence: `rightPaneOpen={!!selectedItem}`

**Issue**: Scrolling feels sluggish

- **Solution**: Use `overflow-auto` instead of `overflow-scroll` and ensure GPU acceleration with `will-change: transform` during animations

---

## Examples in Codebase

| Page/Component | Configuration | Use Case |
|----------------|---------------|----------|
| Calls Library | Main + Right | Call detail view |
| Intel Feed | Left + Main + Right | Filters + feed + detail |
| Agent Builder | Left + Main | Template library + editor |
| Contacts | Main + Right | Contact detail drawer |

---

## Future Enhancements

- **Adjustable Widths**: Allow users to resize panes via drag handles
- **Pane Memory**: Remember which panes were open on page refresh
- **Keyboard Shortcuts**: `⌘+B` for left pane, `⌘+I` for right pane
- **Animations**: Add slide-in/slide-out animations for pane content
