# SPEC: Chat Context Library Integration

**Version:** 1.1
**Status:** Draft
**Created:** 2026-01-12
**Updated:** 2026-01-12
**Author:** Claude (from user requirements)

> **v1.1 Updates:** Added Recents tab, full CRUD operations (rename, delete, bulk delete, replace), clarified context persistence behavior.

---

## 1. Vision

Extend the AI Chat to become a **context-aware assistant** that can reference any content the user has created or uploaded. Users should be able to pull in documents, images, hooks, posts, emails, and transcripts as context for conversations.

### Core User Value

> "Here are 3 pieces of content from my library. Use these as examples and create another piece like them, but with X changes."

### The One-Click Promise

This feature should minimize friction:
- Single `@` trigger for all content types
- One-click selection from Library Browser
- Visual pills showing what's attached
- No folder hierarchy complexity in v1

---

## 2. Feature Summary

### What We're Building

1. **Library Browser Pane** - Slide-in 4th pane showing all available context sources
2. **Extended @ Mentions** - Support all content types in unified search (sectioned by type)
3. **Documents Library** - Upload and store PDFs, DOCX, TXT, MD, CSV, XLSX
4. **Images Library** - Upload and store PNG, JPG with AI-powered OCR
5. **Chatability for Existing Libraries** - Make hooks/content selectable as chat context

### What We're NOT Building (v1)

- Folder hierarchy for documents/images
- Complex organization features
- Tagging system for uploaded content
- Team/shared document libraries

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           AI CHAT                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   CONTEXT SOURCES                              CHAT INTERFACE         │
│   ───────────────                              ──────────────         │
│                                                                       │
│   ┌─────────────┐                             ┌──────────────────┐   │
│   │ Transcripts │──┐                          │   Context Bar    │   │
│   │  (existing) │  │                          │  [pill] [pill]   │   │
│   └─────────────┘  │                          └──────────────────┘   │
│   ┌─────────────┐  │    ┌──────────────┐      ┌──────────────────┐   │
│   │  Documents  │──┼───▶│   Library    │─────▶│   Chat Input     │   │
│   │    (NEW)    │  │    │   Browser    │      │  [@mention...]   │   │
│   └─────────────┘  │    │    Pane      │      └──────────────────┘   │
│   ┌─────────────┐  │    └──────────────┘      ┌──────────────────┐   │
│   │   Images    │──┤                          │   AI Response    │   │
│   │    (NEW)    │  │                          │   (with context) │   │
│   └─────────────┘  │                          └──────────────────┘   │
│   ┌─────────────┐  │                                                  │
│   │    Hooks    │──┤                                                  │
│   │  (existing) │  │                                                  │
│   └─────────────┘  │                                                  │
│   ┌─────────────┐  │                                                  │
│   │   Content   │──┘                                                  │
│   │(posts/email)│                                                     │
│   └─────────────┘                                                     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Existing Infrastructure (LEVERAGE - DO NOT REBUILD)

### Panel System
- **File:** `src/stores/panelStore.ts`
- **Action:** Add new panel type `'library-browser'`
- **Pattern:** Follow existing slide-in behavior (200-300ms animation)

### @ Mention System
- **File:** `src/hooks/useMentions.ts`
- **Current:** Supports `@[Title](recording:id)` for calls only
- **Action:** Extend to support all content types with sectioned dropdown

### Chat Context
- **File:** `src/pages/Chat.tsx`
- **Current ContextAttachment type:**
```typescript
interface ContextAttachment {
  type: 'call';
  id: number;
  title: string;
  date?: string;
}
```
- **Action:** Extend type to support all content sources

### Existing Content Libraries
- **Hooks:** `src/stores/hooksLibraryStore.ts` - Has `hook_text` field
- **Content Items:** `src/stores/contentItemsStore.ts` - Has `content_text` field
- **Database:** `hooks`, `content_items` tables already exist
- **Action:** No changes needed, just integrate with chat

### Pane Pattern Reference
- **File:** `src/components/panes/SettingsCategoryPane.tsx`
- **Width:** 280px
- **Animation:** Slide from right, 200-300ms
- **Structure:** Tabs with content sections

### Table Pattern Reference
- **File:** `src/components/transcript-library/TranscriptTable.tsx`
- **Hook:** `src/hooks/useTableSort.ts`
- **Pattern:** Sortable, filterable, selectable rows

---

## 5. Database Schema (NEW)

### Documents Table

```sql
-- Simple documents library (flat list, no folders in v1)
CREATE TABLE user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf', 'docx', 'txt', 'md', 'csv', 'xlsx'
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text TEXT, -- Full text content for chat context
  extraction_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX idx_user_documents_created_at ON user_documents(created_at DESC);

-- RLS
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents" ON user_documents
  FOR ALL USING (auth.uid() = user_id);
```

### Images Table

```sql
-- Simple images library (flat list, no folders in v1)
CREATE TABLE user_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'png', 'jpg', 'jpeg'
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  ocr_text TEXT, -- AI-extracted text from image
  ocr_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'skipped'
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_user_images_user_id ON user_images(user_id);
CREATE INDEX idx_user_images_created_at ON user_images(created_at DESC);

-- RLS
ALTER TABLE user_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own images" ON user_images
  FOR ALL USING (auth.uid() = user_id);
```

### Storage Buckets

```sql
-- Create storage buckets (run via Supabase dashboard or migration)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('user-documents', 'user-documents', false),
  ('user-images', 'user-images', false);

-- Storage policies
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'user-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Same policies for user-images bucket
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'user-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 6. Edge Functions (NEW)

### upload-document

```typescript
// supabase/functions/upload-document/index.ts
// Handles: file upload, storage, text extraction trigger

// Flow:
// 1. Validate file type (pdf, docx, txt, md, csv, xlsx)
// 2. Validate file size (max 10MB)
// 3. Upload to user-documents bucket
// 4. Create user_documents record with extraction_status='pending'
// 5. Trigger async text extraction
// 6. Return document record
```

### upload-image

```typescript
// supabase/functions/upload-image/index.ts
// Handles: file upload, storage, OCR trigger

// Flow:
// 1. Validate file type (png, jpg, jpeg)
// 2. Validate file size (max 10MB)
// 3. Upload to user-images bucket
// 4. Create user_images record with ocr_status='pending'
// 5. Trigger async OCR processing
// 6. Return image record
```

### process-document

```typescript
// supabase/functions/process-document/index.ts
// Handles: Text extraction from uploaded documents

// Libraries:
// - pdf-parse for PDFs
// - mammoth for DOCX
// - xlsx for Excel files
// - Direct read for TXT, MD, CSV

// Flow:
// 1. Download file from storage
// 2. Extract text based on file type
// 3. Update user_documents.extracted_text
// 4. Set extraction_status='completed'
```

### process-image

```typescript
// supabase/functions/process-image/index.ts
// Handles: OCR via OpenAI Vision API

// Model: GPT-4o via OpenRouter
//
// Flow:
// 1. Download image from storage
// 2. Convert to base64
// 3. Call OpenAI Vision API via OpenRouter
// 4. Extract text content from image
// 5. Update user_images.ocr_text
// 6. Set ocr_status='completed'
```

---

## 7. Frontend Components

### Extended Context Types

```typescript
// src/types/chat-context.ts

export type ContextSourceType = 'call' | 'document' | 'image' | 'hook' | 'content';

export interface ContextAttachment {
  type: ContextSourceType;
  id: string | number;
  title: string;
  date?: string;
  contentPreview?: string; // First 100 chars for tooltip
  contentType?: 'post' | 'email'; // For content items
}

// Markdown formats for each type
export const CONTEXT_MENTION_FORMATS = {
  call: (id: number, title: string) => `@[${title}](recording:${id})`,
  document: (id: string, title: string) => `@[${title}](document:${id})`,
  image: (id: string, title: string) => `@[${title}](image:${id})`,
  hook: (id: string, title: string) => `@[${title}](hook:${id})`,
  content: (id: string, title: string) => `@[${title}](content:${id})`,
};
```

### Documents Store

```typescript
// src/stores/documentsStore.ts

interface UserDocument {
  id: string;
  user_id: string;
  name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extracted_text: string | null;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

interface DocumentsState {
  documents: UserDocument[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  uploadProgress: number;
}

interface DocumentsActions {
  // Read
  fetchDocuments: () => Promise<void>;
  getDocumentText: (id: string) => string | null;

  // Create
  uploadDocument: (file: File) => Promise<UserDocument>;

  // Update
  renameDocument: (id: string, newName: string) => Promise<void>;
  replaceDocument: (id: string, file: File) => Promise<UserDocument>; // Re-upload

  // Delete
  deleteDocument: (id: string) => Promise<void>;
  bulkDeleteDocuments: (ids: string[]) => Promise<void>;
}
```

### Images Store

```typescript
// src/stores/imagesStore.ts

interface UserImage {
  id: string;
  user_id: string;
  name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  ocr_text: string | null;
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  width: number | null;
  height: number | null;
  created_at: string;
}

interface ImagesState {
  images: UserImage[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  uploadProgress: number;
}

interface ImagesActions {
  // Read
  fetchImages: () => Promise<void>;
  getImageUrl: (id: string) => string;
  getImageText: (id: string) => string | null;

  // Create
  uploadImage: (file: File) => Promise<UserImage>;

  // Update
  renameImage: (id: string, newName: string) => Promise<void>;
  replaceImage: (id: string, file: File) => Promise<UserImage>; // Re-upload

  // Delete
  deleteImage: (id: string) => Promise<void>;
  bulkDeleteImages: (ids: string[]) => Promise<void>;
}
```

### Library Browser Pane

```typescript
// src/components/panes/LibraryBrowserPane.tsx

/**
 * Slide-in pane for browsing and selecting context items
 *
 * Structure:
 * - Header with "Add to Chat" title and close button
 * - Tabs: Recent | Calls | Documents | Images | Hooks | Content
 * - Search input within each tab
 * - Scrollable list of items with checkboxes
 * - Footer with "Add Selected (X)" button
 * - Context menu on items: Rename, Delete, Add to Chat
 *
 * Behavior:
 * - Slides in from right (280px width)
 * - Default tab: Recent (shows recently used/uploaded across all types)
 * - Multi-select via checkboxes
 * - Click "Add Selected" to add to context bar
 * - Auto-closes after adding
 * - Right-click or kebab menu for item actions (rename, delete)
 * - Bulk actions when multiple selected (Delete Selected)
 *
 * State:
 * - Uses panelStore for open/close
 * - Local state for selected items
 * - Passes selections back to Chat.tsx
 */
```

### File Upload Zone

```typescript
// src/components/library/FileUploadZone.tsx

/**
 * Drag-and-drop upload zone for documents and images
 *
 * Props:
 * - accept: string[] - Accepted file types
 * - maxSize: number - Max file size in bytes (default 10MB)
 * - onUpload: (file: File) => Promise<void>
 * - uploading: boolean
 * - progress: number
 *
 * Features:
 * - Drag-and-drop visual feedback
 * - Click to open file picker
 * - File type validation with error message
 * - Size validation with error message
 * - Progress indicator during upload
 * - Success/error states
 */
```

### Extended Mentions Hook

```typescript
// src/hooks/useMentionsExtended.ts (or modify existing useMentions.ts)

/**
 * Extended @ mention system supporting all content types
 *
 * Changes from current useMentions.ts:
 * - Search across: calls, documents, images, hooks, content items
 * - Section results by type with headers
 * - Show type icon for each result
 * - Insert correct markdown format per type
 *
 * Dropdown structure:
 * ┌─────────────────────────┐
 * │ 🔍 Search...            │
 * ├─────────────────────────┤
 * │ CALLS                   │
 * │   📞 Sales Call - Acme  │
 * │   📞 Demo - BigCorp     │
 * ├─────────────────────────┤
 * │ DOCUMENTS               │
 * │   📄 Brand Guidelines   │
 * │   📄 Product Specs      │
 * ├─────────────────────────┤
 * │ HOOKS                   │
 * │   🪝 Pain point hook    │
 * ├─────────────────────────┤
 * │ CONTENT                 │
 * │   📝 LinkedIn post #1   │
 * └─────────────────────────┘
 */
```

---

## 8. UI/UX Flow

### Adding Context via Library Browser

```
1. User in Chat sees "📚" button in input footer (next to model selector)

2. User clicks "📚" button
   └── Library Browser pane slides in from right (280px)

3. User sees tabs: [Recent] [Calls] [Documents] [Images] [Hooks] [Content]
   └── Default tab: Recent (shows recently used/uploaded items across all types)

4. User clicks "Documents" tab
   └── Shows list of uploaded documents
   └── Each item has: checkbox, icon, name, date, size
   └── Search bar at top filters list

5. User clicks checkboxes on 2 documents
   └── Footer shows: "Add Selected (2)"

6. User clicks "Add Selected (2)"
   └── Pane closes
   └── 2 pills appear in context bar
   └── Pills show: 📄 icon + truncated name + X button

7. User types message and sends
   └── Chat includes document text as context
```

### Adding Context via @ Mentions

```
1. User types "@" in chat input

2. Dropdown appears with sectioned results
   └── CALLS section: 📞 items
   └── DOCUMENTS section: 📄 items
   └── HOOKS section: 🪝 items
   └── CONTENT section: 📝 items

3. User types "brand" to filter
   └── Results filtered across all types
   └── "📄 Brand Guidelines" appears in DOCUMENTS

4. User clicks or arrows to "Brand Guidelines"
   └── Dropdown closes
   └── Text inserted: @[Brand Guidelines](document:abc123)
   └── Pill added to context bar

5. User continues typing message and sends
```

### Context Bar Display

```
┌──────────────────────────────────────────────────────────────────────┐
│ Context: [📞 Sales Call ×] [📄 Brand Guide... ×] [🪝 Hook #1 ×]     │
│                                                     5 items 🟠      │
└──────────────────────────────────────────────────────────────────────┘

- Pills grouped by type (calls first, then docs, then hooks, etc.)
- Counter shows total: "5 items"
- Counter turns orange at 5+ items
- Counter turns red at 10 items
- Toast appears at 5 items: "Consider limiting context for best results"
- Hover on pill shows full title + content preview
```

### Uploading Documents/Images

```
1. User opens Library Browser pane

2. User clicks "Documents" tab

3. User sees "Upload" button at top of list
   └── OR drags file onto the list area

4. Upload zone appears / file picker opens

5. User selects "product-specs.pdf" (2.3 MB)
   └── Validation: ✅ PDF allowed, ✅ Under 10MB

6. Upload progress shows (0% → 100%)

7. Document appears in list with "Processing..." badge
   └── extraction_status = 'processing'

8. After ~5 seconds, badge changes to ready
   └── extraction_status = 'completed'
   └── Document now selectable for context
```

### Managing Documents/Images (CRUD)

```
RENAME:
1. User hovers over document/image in list
2. Kebab menu (⋮) appears on right
3. User clicks menu → "Rename"
4. Inline edit mode activates (or small dialog)
5. User types new name, presses Enter
6. Name updated

DELETE (Single):
1. User clicks kebab menu → "Delete"
2. Confirmation dialog: "Delete 'filename.pdf'?"
3. User confirms
4. Item removed from list

BULK DELETE:
1. User selects multiple items via checkboxes
2. Footer shows: "3 selected" + [Delete] [Add to Chat]
3. User clicks "Delete"
4. Confirmation: "Delete 3 items?"
5. User confirms
6. Items removed

REPLACE (Re-upload):
1. User clicks kebab menu → "Replace"
2. File picker opens
3. User selects new file (same type)
4. Upload replaces old file
5. Text re-extracted for new content
```

---

## 9. Context Limit Warning System

### Thresholds

| Items | Visual | Toast |
|-------|--------|-------|
| 1-4 | Normal counter | None |
| 5-7 | Orange counter | "Consider limiting context for best AI results" |
| 8-9 | Orange counter | None (already warned) |
| 10 | Red counter | "Maximum context reached. Remove items to add more." |
| 10+ | Red counter, disabled add | Block adding more |

### Implementation

```typescript
const SOFT_LIMIT = 5;
const HARD_LIMIT = 10;

const getCounterColor = (count: number) => {
  if (count >= HARD_LIMIT) return 'text-red-500';
  if (count >= SOFT_LIMIT) return 'text-cb-accent'; // vibe orange
  return 'text-cb-ink-muted';
};

const shouldWarn = (prevCount: number, newCount: number) => {
  return prevCount < SOFT_LIMIT && newCount >= SOFT_LIMIT;
};

const canAddMore = (count: number) => count < HARD_LIMIT;
```

---

## 10. Chat Submission Integration

### Current Flow (in Chat.tsx)

```typescript
// Current: Only handles calls
if (contextAttachments.length > 0) {
  const attachmentMentions = contextAttachments
    .map((a) => `@[${a.title}](recording:${a.id})`)
    .join(" ");
  inputToSubmit = `[Context: ${attachmentMentions}]\n\n${input}`;
  setContextAttachments([]);
}
```

### New Flow

```typescript
// New: Handle all context types
if (contextAttachments.length > 0) {
  const attachmentMentions = contextAttachments
    .map((a) => {
      switch (a.type) {
        case 'call':
          return `@[${a.title}](recording:${a.id})`;
        case 'document':
          return `@[${a.title}](document:${a.id})`;
        case 'image':
          return `@[${a.title}](image:${a.id})`;
        case 'hook':
          return `@[${a.title}](hook:${a.id})`;
        case 'content':
          return `@[${a.title}](content:${a.id})`;
        default:
          return '';
      }
    })
    .join(" ");
  inputToSubmit = `[Context: ${attachmentMentions}]\n\n${input}`;
  setContextAttachments([]);
}
```

### Backend Context Resolution

The chat-stream Edge Function needs to resolve context references:

```typescript
// In chat-stream/index.ts

async function resolveContextReferences(
  message: string,
  userId: string
): Promise<{ resolvedMessage: string; contextText: string }> {
  const contextRegex = /@\[([^\]]+)\]\((recording|document|image|hook|content):([^)]+)\)/g;
  const matches = [...message.matchAll(contextRegex)];

  let contextParts: string[] = [];

  for (const match of matches) {
    const [, title, type, id] = match;
    let text = '';

    switch (type) {
      case 'recording':
        text = await getTranscriptText(id, userId);
        break;
      case 'document':
        text = await getDocumentText(id, userId);
        break;
      case 'image':
        text = await getImageOcrText(id, userId);
        break;
      case 'hook':
        text = await getHookText(id, userId);
        break;
      case 'content':
        text = await getContentItemText(id, userId);
        break;
    }

    if (text) {
      contextParts.push(`--- ${title} (${type}) ---\n${text}`);
    }
  }

  const contextText = contextParts.join('\n\n');
  const resolvedMessage = message.replace(/\[Context:[^\]]+\]\n\n/, '');

  return { resolvedMessage, contextText };
}
```

---

## 11. Implementation Phases

### Phase 1: Database & Storage Setup (Day 1)
- [ ] Create `user_documents` table migration
- [ ] Create `user_images` table migration
- [ ] Set up `user-documents` storage bucket
- [ ] Set up `user-images` storage bucket
- [ ] Create RLS policies for both

### Phase 2: Upload Infrastructure (Days 2-3)
- [ ] Create `upload-document` Edge Function
- [ ] Create `upload-image` Edge Function
- [ ] Create `process-document` Edge Function (text extraction)
- [ ] Create `process-image` Edge Function (OCR via OpenAI Vision)
- [ ] Test all file types

### Phase 3: Frontend Stores (Day 4)
- [ ] Create `documentsStore.ts` (Zustand)
- [ ] Create `imagesStore.ts` (Zustand)
- [ ] Add React Query hooks for CRUD
- [ ] Test store operations

### Phase 4: Library Browser Pane (Days 5-6)
- [ ] Add `'library-browser'` to panelStore
- [ ] Build `LibraryBrowserPane` component
- [ ] Implement tabs for each content type
- [ ] Add search within tabs
- [ ] Implement multi-select
- [ ] Add "Add Selected" action
- [ ] Build `FileUploadZone` component

### Phase 5: Chat Integration (Days 7-8)
- [ ] Extend `ContextAttachment` type
- [ ] Extend `useMentions` for all types
- [ ] Update context bar to show all types with icons
- [ ] Implement context limit warning (toast + counter)
- [ ] Add "📚" button to chat input footer
- [ ] Update `chat-stream` to resolve all context types

### Phase 6: Polish & Testing (Days 9-10)
- [ ] Loading states for all operations
- [ ] Error handling and messages
- [ ] Mobile responsiveness
- [ ] Accessibility (keyboard nav, screen readers)
- [ ] End-to-end testing
- [ ] Performance optimization

---

## 12. File Types & Processing

### Documents

| Extension | MIME Type | Extraction Library |
|-----------|-----------|-------------------|
| .pdf | application/pdf | pdf-parse |
| .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | mammoth |
| .txt | text/plain | Direct read |
| .md | text/markdown | Direct read |
| .csv | text/csv | Direct read (or parse to structured text) |
| .xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | xlsx library |

### Images

| Extension | MIME Type | OCR Method |
|-----------|-----------|------------|
| .png | image/png | OpenAI Vision (GPT-4o) via OpenRouter |
| .jpg/.jpeg | image/jpeg | OpenAI Vision (GPT-4o) via OpenRouter |

### Size Limits

- Maximum file size: **10 MB**
- Maximum extracted text: **100,000 characters** (truncate with warning)

---

## 13. Acceptance Criteria

### Core Functionality
- [ ] User can upload documents (PDF, DOCX, TXT, MD, CSV, XLSX) to Documents library
- [ ] User can upload images (PNG, JPG) to Images library
- [ ] Text is automatically extracted from documents
- [ ] OCR text is extracted from images via OpenAI Vision
- [ ] Library Browser pane slides in showing all content types
- [ ] **Recent tab shows recently used/uploaded items across all types (default tab)**
- [ ] User can select multiple items from any library
- [ ] Selected items appear as pills in chat context bar
- [ ] @ mentions work for all content types (sectioned dropdown)
- [ ] Warning toast appears when context exceeds 5 items
- [ ] Counter turns orange at 5+ items, red at 10
- [ ] Adding blocked at 10 items with message
- [ ] Chat AI receives text content from all attached items
- [ ] User can remove context items by clicking X on pill
- [ ] Libraries persist for future chat sessions
- [ ] **Context persists within same chat thread, clears on new chat**

### CRUD Operations (Documents & Images)
- [ ] User can rename documents/images via kebab menu
- [ ] User can delete individual documents/images with confirmation
- [ ] User can bulk delete multiple selected items
- [ ] User can replace (re-upload) a document/image

### UI/UX
- [ ] Library Browser follows existing pane patterns (280px, slide animation)
- [ ] Uses Remix Icons only
- [ ] Follows brand-guidelines-v4.1.md exactly
- [ ] Vibe orange only for approved uses
- [ ] Responsive on mobile (pane overlays content)

### Performance
- [ ] Document upload < 5 seconds for 5MB file
- [ ] Text extraction < 10 seconds for typical PDF
- [ ] Image OCR < 10 seconds
- [ ] Library loads < 1 second with 100 items

---

## 14. Design Requirements

### Colors
- Context pills background: `bg-cb-component`
- Pill text: `text-cb-ink`
- Pill icon: `text-cb-ink-muted`
- Remove X: `text-cb-ink-muted` → `text-cb-ink` on hover
- Counter normal: `text-cb-ink-muted`
- Counter warning (5+): `text-cb-accent` (#FF8800)
- Counter danger (10): `text-red-500`

### Icons (Remix Icon)
- Calls: `RiPhoneLine`
- Documents: `RiFileTextLine`
- Images: `RiImageLine`
- Hooks: `RiAnchorLine` (or appropriate hook icon)
- Content: `RiEdit2Line`
- Library Browser toggle: `RiFolderOpenLine` or `RiStackLine`

### Typography
- Tab labels: Inter Medium 14px
- List item titles: Inter Regular 14px
- List item metadata: Inter Light 12px, `text-cb-ink-muted`
- Counter: Inter Medium 12px

### Spacing
- Pane width: 280px (match existing panes)
- Tab padding: 12px horizontal
- List item padding: 12px
- Between items: 4px gap

---

## 15. Future Considerations (v2+)

Not in scope for v1, but design should accommodate:

- **Folder organization** for documents/images
- **Team/shared libraries** for collaborative workspaces
- **Web page capture** - Save URLs as context
- **Audio/video transcription** - Upload recordings
- **Smart suggestions** - AI recommends relevant context
- **Context templates** - Save common context combinations
- **Embeddings/RAG** - Semantic search across all content

---

## 16. Resolved Questions

1. **Document management**: Full CRUD - users can rename, delete, and re-upload (replace) documents. We're not adding in-document editing (like editing a PDF), just library management.

2. **Recents tab**: YES - Add a "Recent" tab as the default tab in Library Browser showing recently used/uploaded items across all types.

3. **Context persistence**:
   - **Within same chat thread**: Context persists in memory for the conversation
   - **Across different chats**: NO automatic persistence - context clears when starting new chat
   - **Library items**: Always persist and can be added to any chat session

4. **Bulk operations**: YES - Include bulk delete for documents/images (standard functionality). Select multiple → Delete selected.

---

**END OF SPEC**
