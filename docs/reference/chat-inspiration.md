This HTML structure appears to be a complex, highly styled **UI component for a text input area with attached action buttons and metadata**, likely used in a **capturing, editing, or chat interface**—consistent with the "ultra premium, clean, precise, with fluid automation and animations that feel immersive" aesthetic you value.

It is broken down into four main parts: the **Capture Actions Bar**, the **Input Container**, the **Editor Area**, and the **Footer/Hint Bar**.

---

## 1. Capture Actions Bar (Bottom-Fixed Overlay)

This component is an **absolute-positioned full-width container** fixed at the bottom of the viewport, designed to float over content. It initially has zero opacity and disables pointer events, suggesting it is meant to appear/fade in only when needed (e.g., when content is selected or an action is pending).

| Component Part | Application Description | HTML Code Snippet |
| :--- | :--- | :--- |
| **Main Wrapper** | Outer container. Positions the whole element at the **bottom-left** of the screen, makes it **full width**, and initially sets it to be **invisible** (`opacity-0`) and **non-interactive** (`pointer-events-none`). The `transition-opacity duration-100` hints at a quick fade-in/out effect. | `<div class="absolute bottom-0 left-0 pointer-events-auto w-full">...</div>` |
| **Inner Full-Height Wrapper** | Ensures the contents within the main wrapper span the full height and width of the available space. | `<div class="w-full h-full">...</div>` |
| **Action Content Wrapper** | Positions the visible bar content (the selected count and action buttons) at the bottom, centering it horizontally (`mx-auto`). It sets a maximum width for tablet/desktop views (`md:max-w-[800px]`). | `<div class="absolute bottom-0 left-0 flex flex-col justify-end w-full px-3 mb-[26px] transition-opacity duration-100 opacity-0 pointer-events-none">...</div>` |
| **Bar Background Container** | The visually prominent background for the actions. It has a rounded design (`rounded-xl`), uses a specific background color (`bg-capture-input`), and has a thin border (`border-thin`). It includes vertical scrolling shadow effects (`scroll-shadow-top`). | `<div class="flex flex-col justify-center w-full md:max-w-[800px] mx-auto h-full mb-2.5 px-2 pt-1 bg-capture-input border-thin scroll-shadow-top rounded-xl">...</div>` |
| **Content Row** | A flexible row that holds the selection count on the left and the action buttons on the right. | `<div class="flex justify-between items-center w-full h-full px-2 py-2 text-body-1 flex-row">...</div>` |
| **Selection Count** | Displays the number of items selected, using small, dimmed text. | `<span class="text-sm text-body-1">0 selected</span>` |
| **Action Buttons Group** | Contains the Copy, Move To, Delete, and Done buttons, laid out with minimal spacing (`gap-2`). | `<div class="flex items-center gap-2">...</div>` |
| **Utility Buttons Group** | Contains the small icon-only buttons for Copy, Move, and Delete. They are transparent with hover effects, using SVG icons for a clean look. | `<div class="flex items-center gap-1">...</div>` |
| **"Done" Button** | A primary action button with a solid background (`bg-quinary`) and a thin border, designed to confirm the actions taken within this bar. | `<button class="font-inter cursor-pointer w-auto inline-flex items-center justify-center whitespace-nowrap rounded-lg font-normal transition-colors focus-visible-outline disabled:cursor-not-allowed disabled:opacity-50 bg-quinary enabled:hover:bg-hover-2 border-thin px-4 py-2 text-sm text-body-1" data-testid="done_action">Done</button>` |

---

## 2. Input Container (Main Body)

This is the main, always-visible wrapper for the user's input/query area.

| Component Part | Application Description | HTML Code Snippet |
| :--- | :--- | :--- |
| **Main Wrapper** | Centers the input area horizontally (`mx-auto`), sets a maximum width (`md:max-w-[800px]`), and applies padding/spacing relative to the bottom. | `<div class="w-full md:max-w-[800px] mx-auto h-full px-4 pb-3 transition-opacity duration-100">...</div>` |
| **Full-Height Wrapper** | Provides a relative context for positioning elements within the input area. | `<div class="w-full h-full relative">...</div>` |
| **Background/Card Container** | The visual "card" housing the editor. It has rounded corners (`rounded-2xl`), a capture input background (`bg-capture-input`), subtle shadow (`shadow-sm`), and a thin border (`border-thin`). | `<div class="w-full h-full rounded-2xl bg-capture-input relative overflow-hidden shadow-sm border-thin">...</div>` |

---

## 3. Editor Area (Input Field and Context Tag)

This section contains the actual text input field and a small tag for adding context, indicating a structured editing environment (likely using a tool like ProseMirror, hinted at by the class names).

| Component Part | Application Description | HTML Code Snippet |
| :--- | :--- | :--- |
| **Inner Padding Wrapper** | Adds padding around the internal elements. | `<div class="w-full h-full p-2">...</div>` |
| **Context Tag Row** | A flexible row positioned at the top of the input area for meta-data or context controls. | `<div class="w-full justify-between flex flex-row gap-0.5 flex-1 items-center min-h-[20px]">...</div>` |
| **"Add context" Tag** | A clickable label with a faint background and border, using a **plus sign SVG** to indicate an expandable or customizable feature, allowing the user to provide additional input context. It darkens/becomes more prominent on hover. | `<div class="group select-none hover:bg-base hover:bg-opacity-5 hover:border-contrast-3 w-auto flex items-center gap-1 h-full mr-0.5 px-2 min-h-[22px] rounded-xl border-thin cursor-pointer">...<span class="text-dim text-xs group-hover:text-body-1">Add context</span></div>` |
| **Scrollable Editor Wrapper** | Manages the maximum height (`max-h-[320px]`) and enables vertical scrolling for the main text input. Note the `explorer-scrollbar` classes, suggesting custom scrollbar styling. | `<div class="p-2 w-full h-full min-h-[40px] max-h-[320px] overflow-y-auto explorer-scrollbar explorer-scrollbar explorer-scrollbar">...</div>` |
| **Tiptap/ProseMirror Editor** | The core editable text area. `contenteditable="true"` is set on the inner `div`, which uses `ProseMirror` and `tiptap` classes, confirming it is a rich text editor framework. The `data-placeholder` attribute defines the grayed-out initial text: "**Ask AI anything, @ to mention**". | `<div class="bg-transparent no-drag gap-1.5 px-1 focus:outline-none overflow-y-auto explorer-scrollbar font-inter font-normal w-full resize-none overflow-hidden text-sm text-body-2" id="chat-prosemirror-editor"><div contenteditable="true" role="textbox" translate="no" class="tiptap ProseMirror" tabindex="0" spellcheck="true"><p class="font-normal pb-1.5 chat-paragraph is-empty is-editor-empty" data-placeholder="Ask AI anything, @ to mention"><br class="ProseMirror-trailingBreak"></p></div></div>` |

---

## 4. Control/Footer Bar

This bar, located beneath the editor, contains the key controls for the AI model selection, mode selection, and final submission/voice input.

| Component Part | Application Description | HTML Code Snippet |
| :--- | :--- | :--- |
| **Footer Wrapper** | A fixed-height (`h-[40px]`) row that aligns items vertically in the center and justifies content (left/right controls). | `<div class="w-full h-[40px] flex flex-row items-center justify-between p-2">...</div>` |
| **Left Controls Group** | Holds the model name tag and the model selection dropdown. | `<div class="flex flex-row items-center gap-1">...</div>` |
| **kAI/Mode Tag** | A distinct button/tag indicating a specific AI mode is active (`kAI`), using an accent color (`bg-accent-periwinkle`) and a unique star/sparkle icon to show activation. | `<button data-state="closed" class="cursor-default"><div class="w-full focus:outline-none select-none rounded-xl max-h-[26px] border-thin cursor-pointer bg-capture-input border-contrast-3 flex items-center gap-x-1 px-2.5 py-1.5 bg-accent-periwinkle border-accent-periwinkle border-opacity-50 bg-opacity-20 text-accent-periwinkle hover:bg-accent-periwinkle hover:bg-opacity-30 hover:text-accent-periwinkle" tabindex="0">...<span class="text-xs">kAI</span></div></button>` |
| **Model Selection Dropdown** | A flexible dropdown (using `role="combobox"`) for selecting the AI model, currently displaying **"Gemini 2 Flash"** along with the Google logo and a chevron to indicate a menu. | `<div class="flex select-none max-h-[26px] max-w-[220px] items-center shadow-sm gap-1.5 cursor-pointer text-xs text-body-1 px-3 py-1.5 rounded-xl border-thin hover:bg-base hover:bg-opacity-5 hover:text-heading focus:outline-none" data-state="closed">...<span>Gemini 2 Flash</span>...</div>` |
| **Web Search Toggle** | A small button/toggle with a globe icon, suggesting the ability to enable or disable web search/context fetching for the current query. | `<div class="rounded-xl focus:outline-none select-none max-h-[26px] border-thin cursor-pointer text-xs bg-capture-input border-contrast-3 flex items-center gap-x-1 px-2 py-1.5 text-body-1 hover:text-heading hover:bg-base hover:bg-opacity-5 hover:border-contrast-3" data-state="closed" tabindex="0">...</div>` |
| **Right Controls Group** | Holds the voice/mic input button. | `<div class="flex flex-row items-center gap-2">...</div>` |
| **Voice Input Button** | An icon-only button with a microphone SVG, used to initiate voice recording or speech-to-text input. | `<div class="px-2 pb-2 cursor-pointer text-body-3 hover:text-heading" data-state="closed" style="opacity: 1; transform: none;">...</div>` |
| **Kortex AI Hint Bar** | A small, subtle hint bar below the main input box, indicating a keyboard shortcut (`TAB`) to toggle a feature named "Kortex AI". | `<div class="text-dim text-[11px] flex w-full items-center select-none pt-0.5 px-1"><div class="flex w-full items-center select-none transition-opacity duration-200 ease-in-out justify-between"><span>Toggle Kortex AI with <kbd class="px-1 py-0.5 text-[9px] bg-quaternary rounded-md border-thin">TAB</kbd></span></div></div>` |

# COMPONENT LEVEL BREAKDOWN AND ACCESS TO REUSABLE PARTS OF THE UI

***

This component is a precise, modular design that serves as a **highly-interactive, context-aware command center** for an AI-powered application.

Would you like me to focus on creating a simplified version of one of these specific components, such as the `Model Selection Dropdown`, using your "clean, precise, Apple aesthetic" for a premium UI look?

Here is a comprehensive breakdown of the main parts/components in your "discover all at one" UI, ordered and separated for clarity. Each part includes a description of its purpose and a summary of the relevant HTML (actual HTML code provided at the end).

***

## Selection Action Bar

**Purpose:**  
Floating toolbar appears when you select items, offering bulk actions.

**Features:**  

- Selection counter ("0 selected")
- Copy, Move, and Delete buttons (SVG icons)
- "Done" button to exit selection mode

**HTML Block:**  

```html
<div class="absolute bottom-0 left-0 flex ... opacity-0 pointer-events-none">
  <div class="...">
    <div class="flex ...">
      <span class="text-sm text-body-1">0 selected</span>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1">
          <!-- Copy, Move, Delete buttons with SVG icons here -->
        </div>
        <button ... data-testid="done_action">Done</button>
      </div>
    </div>
  </div>
</div>
```

***

## Main Chat Input Container

**Purpose:**  
Primary wrapper for everything below, with max width and centering.

**Features:**  

- Responsive width (max 800px)
- Centered and rounded with a shadow
- Custom background

**HTML Block:**  

```html
<div class="w-full md:max-w-[800px] mx-auto h-full px-4 pb-3 ...">
  <div class="w-full h-full relative">
    ...
  </div>
</div>
```

***

## Add Context Bar

**Purpose:**  
Button at the top for adding context or attachments.

**Features:**  

- Plus SVG icon
- "Add context" label
- Group/hover visual feedback

**HTML Block:**  

```html
<div class="w-full h-full p-2">
  <div class="flex flex-row ...">
    <div class="group select-none hover:bg-base ...">
      <svg><!-- Plus Icon --></svg>
      <span class="text-dim text-xs group-hover:text-body-1">Add context</span>
    </div>
  </div>
</div>
```

***

## Text Editor (ProseMirror)

**Purpose:**  
The main message input area with rich text and mentions.

**Features:**  

- Contenteditable ProseMirror div (`tiptap ProseMirror`)
- Placeholder: "Ask AI anything, @ to mention"
- Scrollable with min/max height constraints
- Spellcheck and empty-state styling

**HTML Block:**  

```html
<div class="p-2 w-full h-full min-h-[40px] max-h-[320px] ...">
  <div id="chat-input-editor">
    <div id="capture-editor">
      <div data-testid="editor_input" class="capture-editor">
        <div ... id="chat-prosemirror-editor">
          <div contenteditable="true" ... class="tiptap ProseMirror" ...>
            <p class="... chat-paragraph is-empty is-editor-empty" data-placeholder="Ask AI anything, @ to mention">
              <br class="ProseMirror-trailingBreak">
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

***

## Bottom Control Bar

**Purpose:**  
Bar with action buttons below the editor.

**Features & HTML:**  

- **kAI Feature Toggle:**  
  Accent button ("kAI" + sparkle icon)  

  ```html
  <button ...>
    <div ...>
      <svg><!-- Sparkle Icon --></svg>
      <span class="text-xs">kAI</span>
    </div>
  </button>
  ```

- **AI Model Selector:**  
  Dropdown for model switching ("Gemini 2 Flash").  

  ```html
  <div class="relative flex ...">
    <div ... role="combobox">
      <div class="flex ...">
        <svg><!-- Google Logo --></svg>
        <span>Gemini 2 Flash</span>
        <svg><!-- Chevron --></svg>
      </div>
    </div>
  </div>
  ```

- **Web Search Toggle:**  
  Toggle button with globe SVG.  

  ```html
  <div class="...">
    <svg><!-- Globe Icon --></svg>
  </div>
  ```

- **Voice Input Button:**  
  Microphone SVG icon, far right.  

  ```html
  <div class="flex items-center ...">
    <div ...>
      <svg><!-- Microphone Icon --></svg>
    </div>
  </div>
  ```

***

## Footer Hint

**Purpose:**  
A footer line showing the keyboard shortcut ("TAB") for toggling Kortex AI.

**Features:**  

- 11px font, dim color
- Stylized <kbd> for the key

**HTML Block:**  

```html
<div class="text-dim text-[11px] flex w-full items-center select-none pt-0.5 px-1">
  <div class="flex w-full ...">
    <span>Toggle Kortex AI with <kbd class="...">TAB</kbd></span>
  </div>
</div>
```

***

## Key Technologies Used

- TipTap/ProseMirror for the editor
- Tailwind CSS utility classes
- SVG icons for buttons and status
- ARIA accessibility attributes (comboboxes, etc.)
- Responsive, accessible markup

***

If you need further breakdowns, like "how does the copy/move/delete button work?", or specific component refactoring suggestions, let me know which part to focus on.
