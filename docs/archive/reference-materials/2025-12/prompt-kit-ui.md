# prompt-kit

> prompt-kit is a library of customizable, high-quality UI components for AI applications. It provides ready-to-use components for building chat experiences, AI agents, autonomous assistants, and more, with a focus on rapid development and beautiful design.

prompt-kit is built on top of shadcn/ui and extends it with specialized components for AI interfaces. It uses Next.js, React 19, and Tailwind CSS. The components are designed to be easily customizable and can be installed individually using the shadcn CLI.

## Table of Contents

- [Installation](#installation)
- [Introduction](#introduction)
- [Components](#components)
  - [Prompt input](#prompt-input)
  - [Code block](#code-block)
  - [Markdown](#markdown)
  - [Message](#message)
  - [Chat container](#chat-container)
  - [Scroll button](#scroll-button)
  - [Loader](#loader)
  - [Prompt suggestion](#prompt-suggestion)
  - [Response stream](#response-stream)
  - [Reasoning](#reasoning)
  - [File upload](#file-upload)
  - [Jsx preview](#jsx-preview)
  - [Tool](#tool)
  - [Source](#source)
- [Blocks](#blocks)
- [Primitives](#primitives)
- [Showcase](#showcase)

## Introduction

**prompt-kit** is a set of customizable, high-quality components built for AI applications, making it easy to design chat experiences, AI agents, autonomous assistants, and more, quickly and beautifully.

**prompt-kit** is built on top of shadcn/ui with the same design principles. But instead of helping you build a component library, it helps you build AI interfaces.

This project is a work in progress, and we're continuously improving and expanding the collection. We'd love to hear your feedback or see your contributions as it evolves!

prompt-kit is open source. Check out the code and contribute on [GitHub](https://github.com/ibelick/prompt-kit).

## Installation

### Prerequisites

Before installing, ensure you have the following:

- [Node.js](https://nodejs.org/en/download/) version **18** or later
- [React](https://react.dev/) version **19** or later

### Install shadcn/ui

First, you'll need to install and configure shadcn/ui in your project. Follow the installation guide at [shadcn/ui documentation](https://ui.shadcn.com/docs/installation).

Once shadcn/ui is set up, you can install **prompt-kit** components using the **shadcn CLI**.

### Using the shadcn CLI

```bash
npx shadcn@latest add "https://prompt-kit.com/c/[COMPONENT].json"
```

### Usage

After installation, import and start using the components in your project:

```tsx
import { PromptInput } from "@/components/ui/prompt-input";
```

## Components

### Prompt Input

An AI Input that allows users to enter and submit text to an AI model.

#### Examples

##### Prompt Input basic

A basic implementation of the prompt input component.

##### Prompt Input with actions

You can use `PromptInputActions` to add actions with tooltips to the `PromptInput`.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/prompt-input.json"
```

#### Component API

##### PromptInput

| Prop          | Type                    | Default | Description                                     |
| :------------ | :---------------------- | :------ | :---------------------------------------------- |
| isLoading     | boolean                 | false   | Loading state of the input                      |
| value         | string                  |         | Controlled value of the input                   |
| onValueChange | (value: string) => void |         | Callback when input value changes               |
| maxHeight     | number \| string        | 240     | Maximum height of the textarea in pixels        |
| onSubmit      | () => void              |         | Callback when form is submitted (Enter pressed) |
| children      | React.ReactNode         |         | Child components to render                      |
| className     | string                  |         | Additional CSS classes                          |

##### PromptInputTextarea

| Prop            | Type                               | Default | Description                            |
| :-------------- | :--------------------------------- | :------ | :------------------------------------- |
| disableAutosize | boolean                            | false   | Disable automatic height adjustment    |
| className       | string                             |         | Additional CSS classes                 |
| onKeyDown       | (e: KeyboardEvent) => void         |         | Keyboard event handler                 |
| disabled        | boolean                            | false   | Disable the textarea input             |
| ...props        | `React.ComponentProps<"textarea">` |         | All other textarea props are supported |

##### PromptInputActions

| Prop      | Type                                   | Default | Description                       |
| :-------- | :------------------------------------- | :------ | :-------------------------------- |
| children  | React.ReactNode                        |         | Child components to render        |
| className | string                                 |         | Additional CSS classes            |
| ...props  | `React.HTMLAttributes<HTMLDivElement>` |         | All other div props are supported |

##### PromptInputAction

| Prop      | Type                                   | Default | Description                                     |
| :-------- | :------------------------------------- | :------ | :---------------------------------------------- |
| tooltip   | React.ReactNode                        |         | Content to show in the tooltip                  |
| children  | React.ReactNode                        |         | Child component to trigger the tooltip          |
| className | string                                 |         | Additional CSS classes for the tooltip          |
| side      | "top" \| "bottom" \| "left" \| "right" | "top"   | Position of the tooltip relative to the trigger |
| disabled  | boolean                                | false   | Disable the tooltip trigger                     |
| ...props  | `React.ComponentProps<typeof Tooltip>` |         | All other Tooltip component props are supported |

### Code Block

A component for displaying code snippets with syntax highlighting and customizable styling.

#### Examples

##### Basic Code Block

A simple code block with syntax highlighting.

##### Code Block with Header

You can use `CodeBlockGroup` to add a header with metadata and actions to your code blocks.

##### Different Languages

You can highlight code in various languages by changing the `language` prop.

###### Python Example

Example of Python code highlighting.

###### CSS Example

Example of CSS code highlighting.

##### Different Themes

Shiki supports many popular themes. Here are some examples:

###### GitHub Dark Theme

Example using the GitHub Dark theme.

###### Nord Theme

Example using the Nord theme.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/code-block.json"
```

#### Component API

##### CodeBlock

| Prop      | Type                              | Default | Description                |
| :-------- | :-------------------------------- | :------ | :------------------------- |
| children  | React.ReactNode                   |         | Child components to render |
| className | string                            |         | Additional CSS classes     |
| ...props  | `React.HTMLProps<HTMLDivElement>` |         | All other div props        |

##### CodeBlockCode

| Prop      | Type                              | Default        | Description                          |
| :-------- | :-------------------------------- | :------------- | :----------------------------------- |
| code      | string                            |                | The code to display and highlight    |
| language  | string                            | "tsx"          | The language for syntax highlighting |
| theme     | string                            | "github-light" | The theme for syntax highlighting    |
| className | string                            |                | Additional CSS classes               |
| ...props  | `React.HTMLProps<HTMLDivElement>` |                | All other div props                  |

##### CodeBlockGroup

| Prop      | Type                                   | Default | Description                |
| :-------- | :------------------------------------- | :------ | :------------------------- |
| children  | React.ReactNode                        |         | Child components to render |
| className | string                                 |         | Additional CSS classes     |
| ...props  | `React.HTMLAttributes<HTMLDivElement>` |         | All other div props        |

#### Usage with Markdown

The `CodeBlock` component is used internally by the `Markdown` component to render code blocks in markdown content. When used within the `Markdown` component, code blocks are automatically wrapped with the `not-prose` class to prevent conflicts with prose styling.

```tsx
import { Markdown } from "@/components/prompt-kit/markdown"

function MyComponent() {
  const markdownContent = `# Example

    \`\`\`javascript
    function greet(name) {
      return \`Hello, \${name}!\`;
    }
    \`\`\`
  `;

  return <Markdown className="prose">{markdownContent}</Markdown>
}
```

#### Tailwind Typography and not-prose

The `CodeBlock` component includes the `not-prose` class by default to prevent Tailwind Typography's prose styling from affecting code blocks. This is important when using the [@tailwindcss/typography](https://github.com/tailwindlabs/tailwindcss-typography) plugin, which provides beautiful typography defaults but can interfere with code block styling.

Since code blocks are styled with Shiki for syntax highlighting, they should not inherit Tailwind Typography styles. The `not-prose` class ensures that code blocks maintain their intended appearance regardless of the surrounding typography context.

```tsx
<article className="prose">
  <h1>My Content</h1>
  <p>This content has prose styling applied.</p>

  {/* The CodeBlock has not-prose to prevent prose styling */}
  <CodeBlock>
    <CodeBlockCode code={code} language="javascript" />
  </CodeBlock>
</article>
```

#### Customizing Syntax Highlighting

The `CodeBlockCode` component uses [Shiki](https://shiki.matsu.io/) for syntax highlighting. You can customize the theme by passing a different theme name to the `theme` prop.

Shiki supports many popular themes including:

- github-light (default)
- github-dark
- dracula
- nord
- and more.

For a complete list of supported themes, refer to the [Shiki documentation](https://github.com/shikijs/shiki/blob/main/docs/themes.md).

### Markdown

A component for rendering Markdown content with support for GitHub Flavored Markdown (GFM) and custom component styling.

#### Examples

##### Basic Markdown

Render basic Markdown with support for bold, italics, lists, code blocks and more.

##### Markdown with Custom Components

You can customize how different Markdown elements are rendered by providing custom components.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/markdown.json"
```

Manual installation:

```bash
npm install react-markdown remark-gfm remark-breaks
```

#### Component API

##### Markdown

| Prop       | Type                                         | Default            | Description                                     |
| :--------- | :------------------------------------------- | :----------------- | :---------------------------------------------- |
| children   | string                                       |                    | Markdown content to render                      |
| className  | string                                       |                    | Additional CSS classes                          |
| components | `Partial<Components>`                        | INITIAL_COMPONENTS | Custom components to override default rendering |
| ...props   | `React.ComponentProps<typeof ReactMarkdown>` |                    | All other ReactMarkdown props                   |

#### Performance Optimization

The Markdown component employs advanced memoization techniques to optimize rendering performance, especially in streaming AI response scenarios. This approach is crucial when rendering chat interfaces where new tokens are continuously streamed.

##### How Memoization Works

Our implementation:

1. Splits Markdown content into discrete semantic blocks using the `marked` library
2. Memoizes each block individually with React's `memo`
3. Only re-renders blocks that have actually changed when new content arrives
4. Preserves already rendered blocks to prevent unnecessary re-parsing and re-rendering

This pattern significantly improves performance in chat applications by preventing the entire message history from re-rendering with each new token, which becomes increasingly important as conversations grow longer.

For AI chat interfaces using streaming responses, always provide a unique `id` prop (typically the message ID) to ensure proper block caching:

```tsx
<Markdown id={message.id}>{message.content}</Markdown>
```

This memoization implementation is based on the [Vercel AI SDK Cookbook](https://sdk.vercel.ai/cookbook/next/markdown-chatbot-with-memoization) with enhancements for better React integration.

#### Customizing Components

You can customize how different Markdown elements are rendered by providing a `components` prop. This is an object where keys are HTML element names and values are React components.

```tsx
const customComponents = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-blue-500">{children}</h1>,
  a: ({ href, children }) => <a href={href} className="text-purple-500 underline">{children}</a>,
  // ... other components
}

<Markdown components={customComponents}>{markdownContent}</Markdown>
```

#### Supported Markdown Features

The Markdown component uses [react-markdown](https://github.com/remarkjs/react-markdown) with [remark-gfm](https://github.com/remarkjs/remark-gfm) to support GitHub Flavored Markdown, which includes:

- Tables
- Strikethrough
- Tasklists
- Literal URLs
- Footnotes

Additionally, the component includes built-in code block highlighting through the `CodeBlock` component.

#### Styling with Tailwind Typography

For the best typography styling experience, we recommend using the [@tailwindcss/typography](https://github.com/tailwindlabs/tailwindcss-typography) plugin. This plugin provides a set of `prose` classes that add beautiful typographic defaults to your markdown content.

```bash
npm install -D @tailwindcss/typography
```

When using the Markdown component with Tailwind Typography, you can apply the `prose` class:

```tsx
<Markdown className="prose dark:prose-invert">{markdownContent}</Markdown>
```

##### Handling Code Blocks

As you've seen in our examples, code blocks within prose content can sometimes cause styling conflicts. The Tailwind Typography plugin provides a `not-prose` class to exclude elements from prose styling:

```tsx
<article className="prose">
  <h1>My Content</h1>
  <p>Regular content with prose styling...</p>

  <div className="not-prose">
    <!-- Code blocks or other elements that shouldn't inherit prose styles -->
  </div>
</article>
```

### Message

A component for displaying messages in a conversation interface, with support for avatars, markdown content, and interactive actions.

#### Examples

##### Basic Message

A simple message component.

##### Message with Markdown

The `markdown` prop enables rendering content as [Markdown](/docs/markdown), perfect for rich text formatting in messages.

##### Message with Actions

You can use `MessageActions` and `MessageAction` to add interactive elements to your messages.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/message.json"
```

#### Component API

##### Message

| Prop      | Type                              | Default | Description                |
| :-------- | :-------------------------------- | :------ | :------------------------- |
| children  | React.ReactNode                   |         | Child components to render |
| className | string                            |         | Additional CSS classes     |
| ...props  | `React.HTMLProps<HTMLDivElement>` |         | All other div props        |

##### MessageAvatar

| Prop      | Type   | Default | Description                            |
| :-------- | :----- | :------ | :------------------------------------- |
| src       | string |         | URL of the avatar image                |
| alt       | string |         | Alt text for the avatar image          |
| fallback  | string |         | Text to display if image fails to load |
| delayMs   | number |         | Delay before showing fallback (in ms)  |
| className | string |         | Additional CSS classes                 |

##### MessageContent

| Prop      | Type                              | Default | Description                           |
| :-------- | :-------------------------------- | :------ | :------------------------------------ |
| children  | React.ReactNode                   |         | Content to display in the message     |
| markdown  | boolean                           | false   | Whether to render content as markdown |
| className | string                            |         | Additional CSS classes                |
| ...props  | `React.HTMLProps<HTMLDivElement>` |         | All other div props                   |

##### MessageActions

| Prop      | Type                              | Default | Description                |
| :-------- | :-------------------------------- | :------ | :------------------------- |
| children  | React.ReactNode                   |         | Child components to render |
| className | string                            |         | Additional CSS classes     |
| ...props  | `React.HTMLProps<HTMLDivElement>` |         | All other div props        |

##### MessageAction

| Prop      | Type                                   | Default | Description                                     |
| :-------- | :------------------------------------- | :------ | :---------------------------------------------- |
| tooltip   | React.ReactNode                        |         | Content to show in the tooltip                  |
| children  | React.ReactNode                        |         | Child component to trigger the tooltip          |
| className | string                                 |         | Additional CSS classes for the tooltip          |
| side      | "top" \| "bottom" \| "left" \| "right" | "top"   | Position of the tooltip relative to the trigger |
| ...props  | `React.ComponentProps<typeof Tooltip>` |         | All other Tooltip component props               |

### Chat Container

A component for creating chat interfaces with intelligent auto-scrolling behavior, designed to provide a smooth experience in conversation interfaces.

#### Examples

##### Chat container basic

Basic chat container with auto-scrolling.

##### Streaming Text Example

A chat container that demonstrates text streaming with automatic scrolling. Click the "Show Streaming" button to see a simulated streaming response with the smart auto-scroll behavior in action.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/chat-container.json"
```

#### Component API

The ChatContainer is built using three separate components that work together:

##### ChatContainerRoot

The main container that provides auto-scrolling functionality using the `use-stick-to-bottom` library.

| Prop      | Type                                   | Default | Description                                     |
| :-------- | :------------------------------------- | :------ | :---------------------------------------------- |
| children  | React.ReactNode                        |         | Child components to render inside the container |
| className | string                                 |         | Additional CSS classes                          |
| ...props  | React.HTMLAttributes\<HTMLDivElement\> |         | All other div props                             |

##### ChatContainerContent

The content wrapper that should contain your messages.

| Prop      | Type                                   | Default | Description                                             |
| :-------- | :------------------------------------- | :------ | :------------------------------------------------------ |
| children  | React.ReactNode                        |         | Child components to render inside the content container |
| className | string                                 |         | Additional CSS classes                                  |
| ...props  | React.HTMLAttributes\<HTMLDivElement\> |         | All other div props                                     |

##### ChatContainerScrollAnchor

An optional scroll anchor element that can be used for scroll targeting.

| Prop      | Type                                   | Default | Description                                |
| :-------- | :------------------------------------- | :------ | :----------------------------------------- |
| className | string                                 |         | Additional CSS classes                     |
| ref       | React.RefObject\<HTMLDivElement\>      |         | Optional ref for the scroll anchor element |
| ...props  | React.HTMLAttributes\<HTMLDivElement\> |         | All other div props                        |

#### Auto-Scroll Behavior

The component uses the `use-stick-to-bottom` library to provide sophisticated auto-scrolling:

- **Smooth Animations**: Uses velocity-based spring animations for natural scrolling
- **Content Resizing**: Automatically detects content changes using ResizeObserver API
- **User Control**: Automatically disables sticky behavior when users scroll up
- **Mobile Support**: Works seamlessly on touch devices
- **Performance**: Zero dependencies and optimized for chat applications
- **Scroll Anchoring**: Prevents content jumping when new content is added above the viewport

Key behaviors:

- **Stick to Bottom**: Automatically scrolls to bottom when new content is added (if already at bottom)
- **Smart Scrolling**: Only scrolls when user is at the bottom, preserves scroll position otherwise
- **Cancel on Scroll**: User can scroll up to cancel auto-scrolling behavior
- **Resume Auto-Scroll**: Returns to auto-scrolling when user scrolls back to bottom

#### Using with ScrollButton

The ChatContainer pairs perfectly with the ScrollButton component. The ScrollButton automatically appears when the user scrolls up and disappears when at the bottom:

```tsx
import { ChatContainerRoot, ChatContainerContent, ChatContainerScrollAnchor } from "@/components/prompt-kit/chat-container"
import { ScrollButton } from "@/components/prompt-kit/scroll-button"

function ChatInterface() {
  return (
    <div className="relative h-[500px]">
      <ChatContainerRoot className="h-full">
        <ChatContainerContent className="space-y-4">
          {/* Your chat messages here */}
          <div>Message 1</div>
          <div>Message 2</div>
          <div>Message 3</div>
        </ChatContainerContent>
        <ChatContainerScrollAnchor />
        <div className="absolute right-4 bottom-4">
          <ScrollButton className="shadow-sm" />
        </div>
      </ChatContainerRoot>
    </div>
  )
}
```

### Scroll Button

A floating button that appears when the user scrolls up and lets them return to the bottom of the chat.

#### Usage

The `ScrollButton` only works inside `ChatContainerRoot`, which uses `use-stick-to-bottom` under the hood.
It **will not work** with a plain `div` or custom scroll container.

#### Examples

##### Basic Scroll Button

A simple implementation of the scroll button that appears when scrolling up and disappears when at the bottom of the container.

##### Custom Scroll Button

Customize the appearance and behavior of the scroll button with different variants, sizes, and threshold values.

##### With Chat Container

The ScrollButton works perfectly with ChatContainer for chat interfaces, providing an easy way for users to navigate long conversations.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/scroll-button.json"
```

#### Component API

##### ScrollButton

| Prop         | Type                                            | Default   | Description                                          |
| :----------- | :---------------------------------------------- | :-------- | :--------------------------------------------------- |
| scrollRef    | React.RefObject\<HTMLElement\>                  |           | Reference to the element to scroll to                |
| containerRef | React.RefObject\<HTMLElement\>                  |           | Reference to the scrollable container                |
| className    | string                                          |           | Additional CSS classes                               |
| threshold    | number                                          | 50        | Distance from bottom (in px) to show/hide the button |
| variant      | "default" \| "outline" \| "ghost" \| etc.       | "outline" | Button variant from your UI button component         |
| size         | "default" \| "sm" \| "lg" \| etc.               | "sm"      | Button size from your UI button component            |
| ...props     | React.ButtonHTMLAttributes\<HTMLButtonElement\> |           | All other button props                               |

### Loader

A loading component with multiple variants to indicate processing states and provide visual feedback to users during wait times.

#### Examples

##### Basic Loader

Showcasing all available loader variants with default settings.

##### Loader Sizes

Customize the size of any loader variant with predefined size options.

##### Loader With Text

Some loader variants support displaying custom text while loading.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/loader.json"
```

_Note: If you are using Tailwind CSS v4, you may have to grab the keyframes and add them to your global.css file manually. Check manual installation for more details._

Manual installation CSS (add to global.css):

```css
@keyframes typing {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-2px);
    opacity: 1;
  }
}

@keyframes loading-dots {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}

@keyframes wave {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(0.6);
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@keyframes text-blink {
  0%,
  100% {
    color: var(--primary);
  }
  50% {
    color: var(--muted-foreground);
  }
}

@keyframes bounce-dots {
  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

@keyframes thin-pulse {
  0%,
  100% {
    transform: scale(0.95);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.4;
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.5);
    opacity: 1;
  }
}

@keyframes shimmer-text {
  0% {
    background-position: 150% center;
  }
  100% {
    background-position: -150% center;
  }
}

@keyframes wave-bars {
  0%,
  100% {
    transform: scaleY(1);
    opacity: 0.5;
  }
  50% {
    transform: scaleY(0.6);
    opacity: 1;
  }
}

@keyframes shimmer {
  0% {
    background-position: 200% 50%;
  }
  100% {
    background-position: -200% 50%;
  }
}

@keyframes spinner-fade {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

#### Component API

##### Loader

| Prop      | Type                                                                                                                                                          | Default    | Description                              |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :--------------------------------------- |
| variant   | "circular" \| "classic" \| "pulse" \| "pulse-dot" \| "dots" \| "typing" \| "wave" \| "bars" \| "terminal" \| "text-blink" \| "text-shimmer" \| "loading-dots" | "circular" | The visual style of the loader           |
| size      | "sm" \| "md" \| "lg"                                                                                                                                          | "md"       | The size of the loader                   |
| text      | string                                                                                                                                                        |            | Text to display (for supported variants) |
| className | string                                                                                                                                                        |            | Additional CSS classes                   |

### Prompt Suggestion

A component for implementing interactive prompt suggestions in AI interfaces. The PromptSuggestion component offers two distinct modes:

- **Normal Mode**: Renders clickable, pill-shaped buttons ideal for suggesting quick prompts in chat interfaces
- **Highlight Mode**: Provides text highlighting to highlight a part of the suggestion

#### Examples

##### Basic Usage

Display clickable prompt suggestions that users can select to populate an input field. You can easily use it with the [PromptInput](/docs/prompt-input) component.

##### Highlighted Prompt Suggestions

Implement prompt suggestions with search term highlighting. It's perfect to showcase a list of related prompts.

##### Complete Chat Interface

Build a full-featured chat interface with dynamic prompt suggestions that switch between both modes.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/prompt-suggestion.json"
```

#### Component API

##### PromptSuggestion

| Prop      | Type                                               | Default   | Description                                                                    |
| :-------- | :------------------------------------------------- | :-------- | :----------------------------------------------------------------------------- |
| children  | React.ReactNode                                    |           | Content to display in the suggestion button                                    |
| variant   | "default" \| "destructive" \| "outline" \| "ghost" | "outline" | Visual variant of the button (normal mode) or "ghost" (highlight mode)         |
| size      | "default" \| "sm" \| "lg" \| "icon"                | "lg"      | Size of the button (normal mode) or "sm" (highlight mode)                      |
| highlight | string                                             | undefined | When provided, enables highlight mode and highlights this text within children |
| className | string                                             |           | Additional CSS classes                                                         |
| ...props  | ButtonHTMLAttributes                               |           | All other button HTML attributes (including onClick)                           |

### Response Stream (experimental)

A component to simulate streaming text on the client side, perfect for fake responses, or any controlled progressive text display.

**We don't recommend to use it for LLM output.**

#### Examples

##### Typewriter Mode

The default mode that types out text character by character, simulating a typing effect.

##### Fade Mode

The fade mode reveals text word by word with a smooth fade-in animation.

##### With Markdown

ResponseStream can be combined with the Markdown component to create rich, animated content, for that you need to use the `useTextStream` hook directly.

Note: If you want to use mode="fade", you need to manually render the segments with appropriate CSS animations.
It can be hard to get it done with markdown, the way is to write a custom `remarkPlugins`. We have a demo but it's a bit too experimental to be included here, happy to receive a PR if you have a good solution.

##### Using the useTextStream Hook with fade mode

When using the useTextStream hook with `fade` mode, you need to manually render the segments with appropriate CSS animations.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/response-stream.json"
```

#### Component API

##### ResponseStream

| Prop               | Type                              | Default      | Description                                                  |
| :----------------- | :-------------------------------- | :----------- | :----------------------------------------------------------- |
| textStream         | string \| AsyncIterable\<string\> |              | The text to stream or an async iterable of text chunks       |
| mode               | "typewriter" \| "fade"            | "typewriter" | The animation mode to use                                    |
| speed              | number                            | 20           | Speed from 1-100, where 1 is slowest and 100 is fastest      |
| className          | string                            | ""           | Additional CSS classes                                       |
| onComplete         | () => void                        |              | Callback function when streaming is complete                 |
| as                 | string                            | "div"        | Element type to render                                       |
| fadeDuration       | number                            |              | Custom fade duration in ms (overrides speed)                 |
| segmentDelay       | number                            |              | Custom delay between segments in ms (overrides speed)        |
| characterChunkSize | number                            |              | Custom characters per frame for typewriter (overrides speed) |

##### useTextStream Hook

###### Parameters

| Parameter          | Type                              | Default      | Description                                                  |
| :----------------- | :-------------------------------- | :----------- | :----------------------------------------------------------- |
| textStream         | string \| AsyncIterable\<string\> |              | The text to stream or an async iterable of text chunks       |
| speed              | number                            | 20           | Speed from 1-100, where 1 is slowest and 100 is fastest      |
| mode               | "typewriter" \| "fade"            | "typewriter" | The animation mode to use                                    |
| onComplete         | () => void                        |              | Callback function when streaming is complete                 |
| fadeDuration       | number                            |              | Custom fade duration in ms (overrides speed)                 |
| segmentDelay       | number                            |              | Custom delay between segments in ms (overrides speed)        |
| characterChunkSize | number                            |              | Custom characters per frame for typewriter (overrides speed) |
| onError            | (error: unknown) => void          |              | Callback function when an error occurs                       |

###### Return Value

| Property        | Type                                | Description                               |
| :-------------- | :---------------------------------- | :---------------------------------------- |
| displayedText   | string                              | The current text being displayed          |
| isComplete      | boolean                             | Whether streaming is complete             |
| segments        | `{ text: string; index: number }[]` | Text segments for fade mode               |
| getFadeDuration | () => number                        | Function to get the current fade duration |
| getSegmentDelay | () => number                        | Function to get the current segment delay |
| reset           | () => void                          | Function to reset the streaming state     |
| startStreaming  | () => void                          | Function to start or restart streaming    |
| pause           | () => void                          | Function to pause streaming               |
| resume          | () => void                          | Function to resume streaming              |

### Reasoning

A collapsible component for showing AI reasoning, explanations, or logic. You can control it manually or let it auto-close when the stream ends. Markdown is supported.

#### Examples

##### Basic Usage

The most basic implementation of the Reasoning component with auto-close functionality when streaming ends.

##### With Markdown

Show rich formatting with markdown support for better structured reasoning content.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/reasoning.json"
```

#### Component API

##### Reasoning

| Prop         | Type                    | Default | Description                                                 |
| :----------- | :---------------------- | :------ | :---------------------------------------------------------- |
| children     | React.ReactNode         |         | The content of the component                                |
| className    | string                  |         | Additional CSS classes                                      |
| open         | boolean                 |         | Control the open state (makes component controlled)         |
| onOpenChange | (open: boolean) => void |         | Callback when open state changes                            |
| isStreaming  | boolean                 |         | When false, automatically closes the reasoning (auto-close) |

##### ReasoningTrigger

| Prop      | Type            | Default | Description                  |
| :-------- | :-------------- | :------ | :--------------------------- |
| children  | React.ReactNode |         | The content of the trigger   |
| className | string          |         | Additional CSS classes       |
| ...props  | HTMLAttributes  |         | Additional HTML button props |

##### ReasoningContent

| Prop             | Type            | Default | Description                               |
| :--------------- | :-------------- | :------ | :---------------------------------------- |
| children         | React.ReactNode |         | The content to be displayed               |
| className        | string          |         | Additional CSS classes                    |
| contentClassName | string          |         | Additional CSS classes for the content    |
| markdown         | boolean         | false   | Enable markdown rendering for the content |
| ...props         | HTMLAttributes  |         | Additional HTML div props                 |

### File Upload

A component for creating drag-and-drop file upload interfaces with support for single or multiple files, custom triggers, and visual feedback during file dragging operations.

#### Examples

##### File Upload with Prompt Input

You can combine the file upload component with the [Prompt Input](/docs/prompt-input) component to create a full-featured input component with file upload support. You can try to drop a file to see the visual feedback.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/file-upload.json"
```

#### Component API

##### FileUpload

| Prop         | Type                    | Default | Description                              |
| :----------- | :---------------------- | :------ | :--------------------------------------- |
| onFilesAdded | (files: File[]) => void |         | Function called when files are added     |
| children     | React.ReactNode         |         | Child components                         |
| multiple     | boolean                 | true    | Allow selection of multiple files        |
| accept       | string                  |         | File types to accept (e.g., ".jpg,.png") |

##### FileUploadTrigger

| Prop      | Type                                       | Default | Description                      |
| :-------- | :----------------------------------------- | :------ | :------------------------------- |
| asChild   | boolean                                    | false   | Use child element as the trigger |
| className | string                                     |         | Additional CSS classes           |
| children  | React.ReactNode                            |         | Child components                 |
| ...props  | `React.ComponentPropsWithoutRef<"button">` |         | All other button props           |

##### FileUploadContent

| Prop      | Type                                   | Default | Description            |
| :-------- | :------------------------------------- | :------ | :--------------------- |
| className | string                                 |         | Additional CSS classes |
| ...props  | `React.HTMLAttributes<HTMLDivElement>` |         | All other div props    |

### JSX Preview (experimental)

A component for rendering JSX strings as React components, with support for streaming content and automatic tag completion.

#### Examples

##### Basic JSX Preview

The `JSXPreview` component can render JSX strings directly into React components.

##### Streaming JSX Preview

The `isStreaming` prop enables real-time rendering of JSX as it's being streamed, with automatic tag completion.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/jsx-preview.json"
```

#### Component API

##### JSXPreview

| Prop        | Type             | Default | Description                                                          |
| :---------- | :--------------- | :------ | :------------------------------------------------------------------- |
| jsx         | string           |         | The JSX string to render                                             |
| isStreaming | boolean          | false   | Whether the JSX is being streamed (enables automatic tag completion) |
| className   | string           |         | Additional CSS classes                                               |
| ...props    | `JsxParserProps` |         | All other props from `react-jsx-parser`                              |

### Tool

Displays tool call details including input, output, status, and errors. Ideal for visualizing AI tool usage in chat UIs. **Compatible with AI SDK v5** architecture.

#### Examples

##### Basic Tool

A basic tool component showing tool call details.

##### Tool States

Show different states of tool execution: pending, running, completed, and error.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/tool.json"
```

#### Component API

##### Tool

| Prop        | Type     | Default | Description                                      |
| :---------- | :------- | :------ | :----------------------------------------------- |
| toolPart    | ToolPart |         | The tool invocation data to display              |
| defaultOpen | boolean  | false   | Whether the tool details are expanded by default |
| className   | string   |         | Additional CSS classes                           |

##### ToolPart

| Prop       | Type                      | Default | Description                                  |
| :--------- | :------------------------ | :------ | :------------------------------------------- |
| type       | string                    |         | The type of the tool                         |
| state      | string                    |         | The state of the tool                        |
| input      | `Record<string, unknown>` |         | The input data to the tool                   |
| output     | `Record<string, unknown>` |         | The output data from the tool                |
| toolCallId | string                    |         | The tool call identifier                     |
| errorText  | string                    |         | The error text if the tool failed to execute |

### Source

Displays website sources used by AI-generated content, showing URL details, titles, and descriptions on hover.

#### Examples

##### Basic Source

A basic source component.

##### Custom Source

Customized source component with additional styling.

#### Installation

```bash
npx shadcn add "https://prompt-kit.com/c/source.json"
```

#### Component API

##### Source

| Prop     | Type            | Default | Description            |
| :------- | :-------------- | :------ | :--------------------- |
| href     | string          |         | The URL of the source  |
| children | React.ReactNode |         | The content to display |

##### SourceTrigger

| Prop        | Type    | Default | Description                 |
| :---------- | :------ | :------ | :-------------------------- |
| label       | string  |         | The label to display        |
| showFavicon | boolean | false   | Whether to show the favicon |
| className   | string  |         | Additional CSS classes      |

##### SourceContent

| Prop        | Type   | Default | Description                |
| :---------- | :----- | :------ | :------------------------- |
| title       | string |         | The title to display       |
| description | string |         | The description to display |
| className   | string  |         | Additional CSS classes     |

## Showcase

Check out these example implementations using prompt-kit components:

- [zola.chat](https://zola.chat/): Open-source AI chat app built with prompt-kit components

### Building something great with prompt-kit?

We'd love to feature your project here.

[Submit your project](https://forms.gle/SfNVyJJMyZ2RfnTb6)

### Featured Projects

- **zola.chat** - Open-source AI chat application
- **emojis.com** - AI emoji generator
- **ottogrid.ai** - AI grid tools
- **aiagent.app** - AI agent platform
- **findappgaps.com** - App gap finder
- **faithbase.ai** - Faith-based AI platform

## Blocks

Building blocks for AI apps. Clean, composable blocks built with shadcn/ui and prompt-kit. Use them to ship faster, works with any React framework.

Available blocks:

- **Prompt input with actions**: `components/blocks/prompt-input-with-actions.tsx`
- **Prompt input with suggestions**: `components/blocks/prompt-input-with-suggestions.tsx`
- **Prompt input with autocomplete**: `components/blocks/prompt-input-with-autocomplete.tsx`
- **Basic full conversation**: `components/blocks/basic-full-conversation.tsx`
- **Conversation with avatars**: `components/blocks/conversation-with-avatars.tsx`
- **Conversation with actions**: `components/blocks/conversation-with-actions.tsx`
- **Conversation with scroll to bottom**: `components/blocks/conversation-with-scroll-to-bottom.tsx`
- **Conversation with prompt input**: `components/blocks/conversation-with-prompt-input.tsx`
- **Sidebar with chat history**: `components/blocks/sidebar-with-chat-history.tsx`
- **Full chat app**: `components/blocks/full-chat-app.tsx`

All blocks are available at [prompt-kit.com/blocks](https://www.prompt-kit.com/blocks).

## Primitives

Ready-to-use primitives for AI applications. These are complete, production-ready components that you can install and use immediately in your projects. They include both frontend components and backend API routes.

Available primitives:

### Chatbot

**Name**: `chatbot`

**Description**: A chatbot component that allows users to chat with an AI model. It uses prompt-kit, shadcn/ui, and AI SDK V5.

**Installation**:

```bash
npx shadcn add "https://prompt-kit.com/c/chatbot.json"
```

**Features**:

- Complete frontend and backend implementation
- Built with prompt-kit components
- shadcn/ui compatible
- Type-safe with TypeScript
- Production ready

### Tool calling

**Name**: `tool-calling`

**Description**: A chatbot with tool calling feature. It uses prompt-kit, shadcn/ui, and AI SDK V5.

**Installation**:

```bash
npx shadcn add "https://prompt-kit.com/c/tool-calling.json"
```

**Features**:

- Complete frontend and backend implementation
- Built with prompt-kit components
- shadcn/ui compatible
- Type-safe with TypeScript
- Production ready

All primitives are available as registry items that can be installed via the shadcn CLI. Each primitive includes both the React component and any necessary API routes.

## Resources

- [GitHub Repository](https://github.com/ibelick/prompt-kit): Source code and issues
- [Installation Guide](https://www.prompt-kit.com/docs/installation): Detailed installation instructions
- [Component Documentation](https://www.prompt-kit.com/docs): Complete component API documentation
- [Blocks](https://www.prompt-kit.com/blocks): Building blocks for AI apps
- [Primitives](https://www.prompt-kit.com/primitives): Ready-to-use AI primitives
- [shadcn/ui Documentation](https://ui.shadcn.com): Documentation for the underlying UI component system
- [Next.js Documentation](https://nextjs.org/docs): Documentation for the Next.js framework
- [Tailwind CSS Documentation](https://tailwindcss.com/docs): Documentation for the Tailwind CSS framework
