# **CALLVAULT: EXHAUSTIVE FEATURE LIST**

**Generated:** December 11, 2025 **Version:** 1.0 **Scope:** All live features (excluding Chat functionality)

---

## TABLE OF CONTENTS

1. [Fathom Integration & Data Sync](#1-fathom-integration--data-sync)  
2. [Transcript Library & Management](#2-transcript-library--management)  
3. [Transcript Editing & Viewing](#3-transcript-editing--viewing)  
4. [Folders (Organizational System)](#4-folders-organizational-system)  
5. [Tags (Classification System)](#5-tags-classification-system)  
6. [Automation Rules](#6-automation-rules)  
7. [Export Capabilities](#7-export-capabilities)  
8. [AI Features](#8-ai-features)  
9. [Settings & Configuration](#9-settings--configuration)  
10. [UI/UX Features](#10-uiux-features)  
11. [Developer / Debug Features](#11-developer--debug-features)  
12. [Summary: Key Differentiators](#summary-key-differentiators-from-fathom)

---

## 1\. FATHOM INTEGRATION & DATA SYNC

### 1.1 Authentication & Connection

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **OAuth Authentication** | Connect via Fathom OAuth for secure API access | N/A |
| **API Key Authentication** | Alternative direct API key \+ secret connection | N/A |
| **Webhook Auto-Sync** | Automatic real-time sync when new calls complete via Fathom webhooks | No |
| **Connection Testing** | Verify API credentials before saving | N/A |
| **OAuth Token Refresh** | Automatic token refresh for uninterrupted service | N/A |

### 1.2 Meeting Sync

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Bulk Historical Sync** | Sync all historical meetings at once | No |
| **Selective Sync** | Choose specific meetings to sync | No |
| **Date Range Filtering** | Filter unsynced meetings by date range before sync | No |
| **Sync Progress Tracking** | Real-time progress bar showing sync status | No |
| **Per-Meeting Tagging During Sync** | Assign tags to individual meetings before syncing | No |
| **Background Sync Jobs** | Long sync operations run in background | No |
| **Resync Individual Calls** | Re-fetch a single meeting from Fathom | No |
| **Resync All Calls** | Re-fetch all synced meetings | No |

---

## 2\. TRANSCRIPT LIBRARY & MANAGEMENT

### 2.1 Call Viewing

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Paginated Table View** | Browse calls with configurable page sizes | Basic |
| **Column Customization** | Show/hide columns (title, date, duration, participants, tags, folders) | No |
| **Sortable Columns** | Sort by any column ascending/descending | Limited |
| **Call Detail Dialog** | Full-screen modal with all call details | Basic |
| **Tabbed Detail View** | Overview, Transcript, Participants, Invitees tabs | Limited |

### 2.2 Search & Filtering

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Full-Text Search** | Search across titles, transcripts, summaries | Basic |
| **Date Range Filter** | Filter by custom date ranges | Limited |
| **Duration Filter** | Filter by meeting length (min/max minutes) | No |
| **Participant Filter** | Filter by specific attendees | No |
| **Tag Filter** | Filter by assigned tags (multiple selection) | No |
| **Folder Filter** | Filter by folder assignment | No |
| **Combined Filters** | Use multiple filters simultaneously | No |
| **Filter Pills** | Visual display of active filters with clear buttons | No |
| **Clear All Filters** | One-click reset of all filters | No |

### 2.3 Bulk Operations

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Multi-Select** | Select multiple calls via checkboxes | No |
| **Select All (Current Page)** | Select all visible calls | No |
| **Bulk Tag Assignment** | Assign tags to multiple calls at once | No |
| **Bulk Tag Removal** | Remove tags from multiple calls | No |
| **Bulk Folder Assignment** | Move multiple calls to a folder | No |
| **Bulk Delete** | Delete multiple calls with confirmation | No |
| **Bulk AI Title Generation** | Generate AI titles for selected calls | No |
| **Bulk Auto-Tagging** | Run AI auto-tagger on selected calls | No |
| **Bulk Export** | Export selected calls to various formats | No |

---

## 3\. TRANSCRIPT EDITING & VIEWING

### 3.1 Transcript Display

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Speaker-Grouped View** | Transcript organized by speaker with avatars | Basic |
| **Timestamp Display** | Optional timestamp per segment | Yes |
| **Raw Text View** | Toggle plain text view without formatting | No |
| **Host vs External Highlighting** | Visual distinction between host and external participants | No |

### 3.2 Transcript Editing (NON-DESTRUCTIVE)

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Edit Segment Text** | Modify any transcript segment's text | No |
| **Change Speaker Name** | Reassign a segment to different speaker | No |
| **Trim/Delete Segments** | Remove unwanted segments (soft delete) | No |
| **Revert Edits** | Restore original text for any segment | No |
| **Edit Tracking** | Track edited vs original content | No |
| **Copy Transcript** | Copy full transcript to clipboard | Yes |

### 3.3 Call Metadata Editing

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Edit Title** | Change meeting title | Yes |
| **Edit Summary** | Modify AI-generated summary | No |
| **AI Title Generation** | Generate better title using AI | No |
| **View Original Fathom Link** | Direct link to call in Fathom | N/A |

---

## 4\. FOLDERS (ORGANIZATIONAL SYSTEM)

### 4.1 Folder Management

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Create Folders** | Create custom folders with name, description | No |
| **Nested Folders** | Create hierarchical folder structure (parent/child) | No |
| **Custom Colors** | Assign color to each folder | No |
| **Custom Icons/Emojis** | Assign icon or emoji to each folder | No |
| **Edit Folders** | Update name, description, color, icon, parent | No |
| **Delete Folders** | Remove folders (with confirmation) | No |
| **Folder Sidebar** | Collapsible sidebar showing folder tree | No |

### 4.2 Folder Operations

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Assign Calls to Folders** | Add calls to any folder | No |
| **Multi-Folder Assignment** | A call can belong to multiple folders | No |
| **Drag-and-Drop** | Drag calls to folders in sidebar | No |
| **Multi-Drag** | Drag multiple selected calls at once | No |
| **Folder Call Counts** | Show number of calls per folder | No |
| **Hide Folders** | Hide folders from sidebar without deleting | No |
| **Quick Create Folder** | Create folder from anywhere via keyboard shortcut | No |

---

## 5\. TAGS (CLASSIFICATION SYSTEM)

### 5.1 Tag Management

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Create Tags** | Create custom tags with name, description | No |
| **Custom Colors** | Assign color to each tag | No |
| **System Tags** | Pre-defined system tags (e.g., "Skip") | No |
| **Edit Tags** | Update tag name, description, color | No |
| **Delete Tags** | Remove tags | No |
| **Tag Call Counts** | Show number of calls per tag | No |

### 5.2 Tag Assignment

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Manual Tag Assignment** | Assign tags to individual calls | No |
| **Primary/Secondary Tags** | Calls can have up to 2 tags (primary \+ secondary) | No |
| **Remove Tags** | Remove tags from calls | No |
| **Tag Dropdown** | Quick tag assignment from table row | No |

---

## 6\. AUTOMATION RULES

### 6.1 Rule Types

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Title Contains** | Match if title contains keyword | No |
| **Title Exact Match** | Match if title equals specific text | No |
| **Title Regex** | Match using regular expression pattern | No |
| **Day/Time Rules** | Match by day of week and hour | No |
| **Transcript Keyword** | Match if transcript contains keywords | No |

### 6.2 Rule Actions

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Auto-Assign Tag** | Automatically assign tag when rule matches | No |
| **Auto-Assign Folder** | Automatically assign folder when rule matches | No |
| **Combined Actions** | Assign both tag AND folder from one rule | No |
| **Rule Priority** | Set execution order for rules | No |
| **Enable/Disable Rules** | Toggle rules without deleting | No |
| **Apply Rules to Existing** | Run rules against all existing calls | No |
| **Rule Statistics** | Track how many times each rule applied | No |

---

## 7\. EXPORT CAPABILITIES

### 7.1 Individual Call Export

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Export to Markdown** | Single call as .md file | No |
| **Export to PDF** | Single call as formatted PDF | No |
| **Export to DOCX** | Single call as Word document | No |
| **Export to TXT** | Plain text export | No |
| **Export to JSON** | Structured data export | No |
| **Include/Exclude Timestamps** | Toggle timestamps in export | No |

### 7.2 Bulk/Smart Export

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Export Multiple Calls** | Export selected calls together | No |
| **Export by Week** | Organize export by week boundaries | No |
| **Export by Tag** | Organize export by tag assignment | No |
| **Export by Folder** | Organize export by folder assignment | No |
| **ZIP Archive Export** | Export multiple calls as ZIP | No |
| **CSV Export** | Export metadata as spreadsheet | No |
| **AI Summary Generation** | Generate cross-call summary during export | No |
| **Include Options** | Toggle: metadata, participants, transcripts, summaries | No |

---

## 8\. AI FEATURES

### 8.1 AI Model Selection

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Multi-Provider Support** | OpenAI, Anthropic, Google, xAI, DeepSeek, Groq | No |
| **15 Model Presets** | Pre-configured model options | No |
| **Save Model Preference** | Remember preferred model | No |

### 8.2 AI Operations

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **AI Title Generation** | Generate descriptive titles from content | No |
| **Bulk Title Generation** | Generate titles for multiple calls | No |
| **Auto-Tagging** | AI suggests tags based on content | No |
| **Bulk Auto-Tagging** | Auto-tag multiple calls at once | No |
| **Meta-Summary Generation** | Generate summary across multiple calls | No |

### 8.3 Knowledge Base / Embeddings

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Transcript Chunking** | Break transcripts into searchable chunks | No |
| **Vector Embeddings** | Generate embeddings for semantic search | No |
| **Embedding Progress Tracking** | Track indexing progress | No |
| **Batch Embedding Jobs** | Background processing of embeddings | No |
| **Index All Transcripts** | One-click index everything | No |
| **Indexing Statistics** | View total chunks, recordings indexed | No |

---

## 9\. SETTINGS & CONFIGURATION

### 9.1 Account Settings

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Display Name** | Set user display name | Yes |
| **Host Email** | Configure which email identifies "host" in calls | No |
| **Timezone Selection** | Set timezone for date/time display | No |
| **Password Change** | Change account password | Yes |

### 9.2 Integration Settings

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Fathom API Configuration** | Manage API key and secret | N/A |
| **OAuth Status Display** | See OAuth connection status | N/A |
| **Webhook Configuration** | Set up webhook for auto-sync | N/A |
| **Connection Status Cards** | Visual status of all integrations | N/A |
| **Knowledge Base Stats** | View embedding/indexing stats | N/A |

### 9.3 Setup Wizard

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Guided Setup** | Step-by-step onboarding wizard | N/A |
| **Credentials Step** | Enter API credentials | N/A |
| **OAuth Step** | Connect via OAuth | N/A |
| **Webhook Step** | Configure webhook | N/A |
| **Settings Step** | Configure host email, timezone | N/A |

---

## 10\. UI/UX FEATURES

### 10.1 Navigation & Layout

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Tabbed Navigation** | Transcripts, Sync, Analytics tabs | Limited |
| **Collapsible Sidebar** | Folder sidebar with collapse toggle | No |
| **Responsive Design** | Works on mobile and desktop | Yes |
| **Dark/Light Mode** | Theme switcher | Yes |

### 10.2 Feedback & Status

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Toast Notifications** | Success/error feedback messages | Limited |
| **Loading States** | Skeleton loaders during data fetch | Basic |
| **Progress Indicators** | Circular/linear progress for operations | No |
| **Empty States** | Helpful messages when no data | Basic |
| **Confirmation Dialogs** | Confirm destructive actions | Basic |

---

## 11\. DEVELOPER / DEBUG FEATURES

### 11.1 Debug Panel

| Feature | Description | Fathom Has? |
| :---- | :---- | :---- |
| **Webhook Delivery Viewer** | Inspect incoming webhook payloads | No |
| **Signature Verification Status** | See if webhook signatures validated | No |
| **Request Headers Inspection** | View raw HTTP headers | No |
| **Debug Dump Export** | Export debug info for troubleshooting | No |

---

## SUMMARY: KEY DIFFERENTIATORS FROM FATHOM

### Things CallVault Does That Fathom CANNOT:

| \# | Capability | Description |
| :---- | :---- | :---- |
| 1 | **Organization** | Folders with nesting, colors, icons \+ Tags with colors |
| 2 | **Automation** | Rules that auto-assign tags/folders based on conditions |
| 3 | **Bulk Operations** | Multi-select, bulk tag, bulk export, bulk AI operations |
| 4 | **Advanced Filtering** | Duration, participants, tags, folders, date ranges |
| 5 | **Export Flexibility** | 6+ formats, organized by week/tag/folder, ZIP archives |
| 6 | **Transcript Editing** | Non-destructive edit text, change speakers, trim segments |
| 7 | **AI Model Choice** | 15+ models across 6 providers |
| 8 | **AI Operations** | Bulk title generation, auto-tagging, meta-summaries |
| 9 | **Knowledge Base** | Vector embeddings for future semantic search |
| 10 | **Webhook Auto-Sync** | Real-time sync when calls complete |
| 11 | **Historical Bulk Sync** | Sync all past calls at once with progress tracking |
| 12 | **Column Customization** | Show/hide columns in transcript table |

---

## STATISTICS

| Metric | Count |
| :---- | :---- |
| **Total Unique Features** | \~95+ |
| **Features Fathom Doesn't Have** | \~85+ |
| **Feature Categories** | 11 |

---

## NOTES

- This document excludes the **Chat** functionality which is under development  
- Features marked "N/A" for Fathom indicate integration-specific features that don't apply to Fathom's native interface  
- "Basic" or "Limited" indicates Fathom has partial functionality in that area  
- "No" indicates Fathom has no equivalent feature

---

*Document generated from codebase analysis on December 11, 2025*

---

# **📋 Complete CallVault App Feature & Capability Breakdown**

## 1️⃣ **Meeting/Call Management Features**

### A. Meeting Sync & Import (Fathom Integration)

- **Manual Meeting Sync**

  - User can fetch meetings from Fathom for specific date ranges.  
  - Preview meeting metadata, attendance, and details before importing.  
  - Select one, several, or all unsynced meetings to import in bulk.  
  - View sync status: synced vs unsynced.  
  - Sync meetings brings in transcript, summary, invitees, and metadata.

- **Automatic Webhook Sync**

  - Fathom webhooks can push new meeting data into CallVault automatically (hands-off update).  
  - Webhook signature verification for security.  
  - Duplicate delivery idempotence—webhooks processed only once.  
  - Robust notification and debugging system for webhook failures.

- **Advanced Rate Limiting & Retry Logic**

  - Automatic handling of Fathom API rate limits and errors.  
  - Exponential backoff retry for failed requests.

#### **VALUE-ADD over Fathom:**

You can combine manual and webhook sync for total control and reliability; automate all ingestion, get granular/manual when you want.

---

## 2️⃣ **Transcript Library and Browsing**

### A. Centralized Transcript Dashboard

- **Unified Table/List View:**

  - See all synced meetings in a searchable, filterable table (title, date, duration, folder, tags, etc.).  
  - View key details: call title, summary, invitees, duration, recording link(s), Fathom/Zoom URL, and more.

- **Faceted Search & Filtering**

  - Full-text search (title, summary, transcript) with inline filters.  
  - Filter calls by tags, folders, participants, date ranges, duration, status, etc.  
  - Quick filter controls (chips/popovers): filter by folder, tag, participant, date, etc.

- **Sidebar Navigation (Folders)**

  - Folders shown in collapsible tree navigation on the left; browse calls by folder or "All Transcripts".

- **Selection & Bulk Actions**

  - Select multiple calls for bulk tagging, folder assignment, deletion, or export.

- **Pagination and Column Control**

  - Fast performance with table pagination (20 per page, customizable).  
  - Shows/hides columns (date, duration, participants, tags, folders).

- **Drag and Drop**

  - Drag rows to folders/tags for fast categorization.

#### **VALUE-ADD over Fathom:**

You get a fully featured, customizable archive and library of all your calls with bulk organization and analysis—Fathom doesn’t provide cross-call dashboarding at this level.

---

## 3️⃣ **Advanced Organization: Folders & Tags**

### A. **Folders (Organization)**

- **Hierarchical Folders**

  - Users create folders to organize calls (3 levels deep — e.g., Clients / CustomerX / ProjectY).  
  - Supports folder icons (emoji/Remix), color coding, sorting, and drag-and-drop structure.  
  - Move calls between folders (one call \= one folder assignment).  
  - "Unfiled" virtual folder for calls with no folder assignment.  
  - UI for folder creation, editing, deletion, and bulk call reassignment.  
  - Deleting a folder moves calls to "Unfiled" (never deletes data).

- **Folder Management**

  - Bulk assign calls to folders from selection.  
  - Edit folder name, icon, parent, order.  
  - Folder usage count shown.  
  - Rules engine (see below) can auto-assign calls to folders.

### B. **Tags (Classification)**

- **System Tags**

  - Fixed set of tags representing call types/purposes.  
  - Each call can have 1 "primary" and 1 "secondary" tag.  
  - Tags control which AI prompts/analysis run on each call type.  
  - Tags visible in table, call detail, and filterable everywhere.  
  - Tag management UI for viewing tag list, usage statistics.  
  - Tag assignments editable, includable in bulk operations.

- **Tag Rule Engine**

  - Create rules to automatically tag calls based on title, keywords, participant, etc.  
  - Bulk apply or preview all rules to calls.  
  - View rule hit rate and status for each rule.

#### **VALUE-ADD over Fathom:**

Fathom has only basic meeting labels; CallVault’s hierarchical folders and rule-driven tag system allow far more granular organization and automation.

---

## 4️⃣ **Bulk Data Operations**

- **Bulk Tagging/Folders**

  - Select N calls → assign or remove a tag/folder in one click.  
  - Supports creating new tags/folders during bulk action.

- **Bulk Delete**

  - Permanently remove multiple calls at once.

- **Bulk Export**

  - Select/export multiple calls in various formats (see next section).

---

## 5️⃣ **Export, Download, and Sharing**

- **Single-Transcript Export**

  - Download any call as TXT, Markdown, or other supporting formats.  
  - Includes summary, full transcript, speakers, and metadata.

- **Bulk Smart Export**

  - Export N calls at once (select format, columns, detail).  
  - Zip multiple files if necessary.  
  - Option to filter which fields to include on export.

---

## 6️⃣ **Call Detail and In-Depth Transcript View**

- **Call Detail Dialog**  
  - Click to view full transcript (with timestamps, speakers, search within transcript).  
  - Inline editing: edit speaker, name, text (where allowed).  
  - Assign tags, folders, or both directly from detail view.  
  - Invitees: Full breakdown of attendee list, including email, role.  
  - Summary & AI insight view (call notes, action items if included from Fathom).  
  - Export/Download from detail view.

---

## 7️⃣ **Rules Engine for Sorting & Tagging**

- **Create Custom Rules**  
  - Match calls by title (exact/contains/regex), participants, day/time, transcript keywords.  
  - Auto-assign folder, tag, or both upon sync/import.  
  - Rule priorities (first match wins), ability to enable/disable rules.  
  - Bulk "Apply Rules Now" for retroactive assignment.  
  - Stats on how many calls each rule has tagged/filed.

---

## 8️⃣ **Recurring Titles / Pattern Detection**

- **Recurring Titles Tab**  
  - Find your most common call titles (pattern detection for regular meeting series).  
  - See when title first/last appeared and count.  
  - Create rules to auto-tag/file calls with this recurring pattern.

---

## 9️⃣ **Analytics & Insights**

- **Analytics Dashboard Tab**  
  - High-level KPIs: Completed calls, participation rate, average call duration, total recording time.  
  - Distribution charts: By folder, tag, call type, duration, invitees vs. participants, monthly trend.  
  - Filter analytics by date range, show/hide various breakdowns.  
  - Impact overview: Participants, folders in use.

---

## 🔟 **Integrations & Knowledge Base / Embedding**

- **Fathom Integration**

  - OAuth or API Key login for data sync.  
  - Webhook configuration via UI, status display, troubleshooting.

- **AI Knowledge Base Indexing**

  - All transcripts chunked and embedded for future AI features.  
  - Indexing progress, stats (calls indexed, chunks created), and re-index operation.

---

## 1️⃣1️⃣ **User & Organization Management**

- **Roles & Permissions**

  - Support for Free, Pro, Team, and Admin roles.  
  - View all users in an organization (admin/team roles), their roles, and onboarding status.  
  - Admin can update user roles and access.

- **Account Preferences**

  - Edit Display Name, email, timezone, Fathom email.  
  - Change password, update credentials.  
  - Configure and test integration secrets (API key, webhook, OAuth).

---

## 1️⃣2️⃣ **Multi-source Planning (Emerging)**

- **Zoom and Other Integrations (UI Ready)**

  - UI stubs for additional sources (Zoom, GoHighLevel, HubSpot) shown as coming soon.

- **User Settings Architecture**

  - User-specific settings stored for seamless multi-integration onboarding.

---

## 1️⃣3️⃣ **Security and Data Integrity**

- **RLS Policies**  
  - All tables are Row-Level Security protected—users only see their own data.  
  - Service role policies for system operations.  
- **Idempotent Webhook Processing**  
  - Each webhook processed only once.

---

## 1️⃣4️⃣ **Development, Debugging, Quality-of-Life (For Admins)**

- **Debug Panel (in-app)**

  - View raw webhook logs, delivery status, errors, and more for troubleshooting.

- **Logger utility**: Consistent error/info logging in both dev and prod modes.

- **Test Helpers**

  - Test environment variables, secrets, and configuration via dedicated endpoints.

---

## 🟢 **Miscellaneous: UX and Brand Features**

- **Design System (shadcn-ui \+ Tailwind)**

  - Unified look and feel according to strict brand guidelines.

- **Responsive Layout**

  - Desktop & mobile-optimized design; sidebars auto-collapse on mobile.

- **Brand-customizable UI**

  - Theme toggling (light/dark modes), brand color tokens, accessible palette.

---

# **🚀 Distinctive Value-Add vs. Fathom**

While Fathom is **primarily a meeting recorder/transcriber/auto-summarizer**, **CallVault** builds on top of this with:

- **True multi-call library:** Side-by-side, cross-call management and tag/folder-based organization.  
- **Advanced bulk actions:** Bulk tagging, foldering, deleting, exporting—Fathom is single-meeting focused.  
- **Granular automation:** User-defined sorting/tagging rules far beyond Fathom's automatic labeling.  
- **Enterprise-ready permissions:** Team/user/role management for organizations.  
- **Analytics dashboard:** Visualization of call patterns across the entire dataset.  
- **Better data export:** Multi-format, selective export at both single and bulk level.  
- **Flexible design & white-label ready:** Brand-guideline adherence and a highly custom UI/UX.  
- **AI Data Preparation:** Indexing all transcripts for future advanced AI search (RAG, Q\&A), not limited to Fathom's own models.

---

# **📝 Summary Table**

| Feature | CallVault | Fathom |
| :---- | :---- | :---- |
| Call Import/Sync | Manual/by webhook (bulk, filterable) | Automatic/manual |
| Transcript Library | Advanced search/filter, folders, tags | List view only |
| Tagging | Customizable, rules-based, multi-tag | Labels |
| Folders | Hierarchical, user-defined | N/A |
| Bulk Actions | Tag, folder, export, delete | N/A |
| Bulk Export | Yes (multi-format, multi-call) | Per-meeting |
| Organization Mgmt | Users, teams, admin roles, permissions | Basic sharing |
| Rules Engine | For tagging/folder assignment | None |
| Advanced Analytics | KPI dashboard, breakdowns | Per-call only |
| Detail Editing | Speaker/name/transcript edit, inline | Yes (limited) |
| Knowledge Base Indexing | All calls chunked/embedded for advanced AI | Not exposed |
| Debug & Observability | Debug panel, logs, test utilities | N/A |

---

# **🎯 In Short: What the Current App Can Do**

**CallVault is a full-featured meeting intelligence system for collecting, organizing, managing, and analyzing meetings at scale, with the ability to bulk operate, automate, and extend well beyond Fathom's basic sync, with advanced rules, analytics, and organization capabilities, all under strict role-based security and a modern UI.**

---

**Let me know if you need elaboration on any particular area, want a visual map, or a "what's possible" table per screen\!**