# CALLVAULT: EXHAUSTIVE FEATURE LIST

**Generated:** December 11, 2025
**Version:** 1.0
**Scope:** All live features (excluding Chat functionality)

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

## 1. FATHOM INTEGRATION & DATA SYNC

### 1.1 Authentication & Connection

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **OAuth Authentication** | Connect via Fathom OAuth for secure API access | N/A |
| **API Key Authentication** | Alternative direct API key + secret connection | N/A |
| **Webhook Auto-Sync** | Automatic real-time sync when new calls complete via Fathom webhooks | No |
| **Connection Testing** | Verify API credentials before saving | N/A |
| **OAuth Token Refresh** | Automatic token refresh for uninterrupted service | N/A |

### 1.2 Meeting Sync

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Bulk Historical Sync** | Sync all historical meetings at once | No |
| **Selective Sync** | Choose specific meetings to sync | No |
| **Date Range Filtering** | Filter unsynced meetings by date range before sync | No |
| **Sync Progress Tracking** | Real-time progress bar showing sync status | No |
| **Per-Meeting Tagging During Sync** | Assign tags to individual meetings before syncing | No |
| **Background Sync Jobs** | Long sync operations run in background | No |
| **Resync Individual Calls** | Re-fetch a single meeting from Fathom | No |
| **Resync All Calls** | Re-fetch all synced meetings | No |

---

## 2. TRANSCRIPT LIBRARY & MANAGEMENT

### 2.1 Call Viewing

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Paginated Table View** | Browse calls with configurable page sizes | Basic |
| **Column Customization** | Show/hide columns (title, date, duration, participants, tags, folders) | No |
| **Sortable Columns** | Sort by any column ascending/descending | Limited |
| **Call Detail Dialog** | Full-screen modal with all call details | Basic |
| **Tabbed Detail View** | Overview, Transcript, Participants, Invitees tabs | Limited |

### 2.2 Search & Filtering

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
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
|---------|-------------|-------------|
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

## 3. TRANSCRIPT EDITING & VIEWING

### 3.1 Transcript Display

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Speaker-Grouped View** | Transcript organized by speaker with avatars | Basic |
| **Timestamp Display** | Optional timestamp per segment | Yes |
| **Raw Text View** | Toggle plain text view without formatting | No |
| **Host vs External Highlighting** | Visual distinction between host and external participants | No |

### 3.2 Transcript Editing (NON-DESTRUCTIVE)

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Edit Segment Text** | Modify any transcript segment's text | No |
| **Change Speaker Name** | Reassign a segment to different speaker | No |
| **Trim/Delete Segments** | Remove unwanted segments (soft delete) | No |
| **Revert Edits** | Restore original text for any segment | No |
| **Edit Tracking** | Track edited vs original content | No |
| **Copy Transcript** | Copy full transcript to clipboard | Yes |

### 3.3 Call Metadata Editing

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Edit Title** | Change meeting title | Yes |
| **Edit Summary** | Modify AI-generated summary | No |
| **AI Title Generation** | Generate better title using AI | No |
| **View Original Fathom Link** | Direct link to call in Fathom | N/A |

---

## 4. FOLDERS (ORGANIZATIONAL SYSTEM)

### 4.1 Folder Management

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Create Folders** | Create custom folders with name, description | No |
| **Nested Folders** | Create hierarchical folder structure (parent/child) | No |
| **Custom Colors** | Assign color to each folder | No |
| **Custom Icons/Emojis** | Assign icon or emoji to each folder | No |
| **Edit Folders** | Update name, description, color, icon, parent | No |
| **Delete Folders** | Remove folders (with confirmation) | No |
| **Folder Sidebar** | Collapsible sidebar showing folder tree | No |

### 4.2 Folder Operations

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Assign Calls to Folders** | Add calls to any folder | No |
| **Multi-Folder Assignment** | A call can belong to multiple folders | No |
| **Drag-and-Drop** | Drag calls to folders in sidebar | No |
| **Multi-Drag** | Drag multiple selected calls at once | No |
| **Folder Call Counts** | Show number of calls per folder | No |
| **Hide Folders** | Hide folders from sidebar without deleting | No |
| **Quick Create Folder** | Create folder from anywhere via keyboard shortcut | No |

---

## 5. TAGS (CLASSIFICATION SYSTEM)

### 5.1 Tag Management

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Create Tags** | Create custom tags with name, description | No |
| **Custom Colors** | Assign color to each tag | No |
| **System Tags** | Pre-defined system tags (e.g., "Skip") | No |
| **Edit Tags** | Update tag name, description, color | No |
| **Delete Tags** | Remove tags | No |
| **Tag Call Counts** | Show number of calls per tag | No |

### 5.2 Tag Assignment

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Manual Tag Assignment** | Assign tags to individual calls | No |
| **Primary/Secondary Tags** | Calls can have up to 2 tags (primary + secondary) | No |
| **Remove Tags** | Remove tags from calls | No |
| **Tag Dropdown** | Quick tag assignment from table row | No |

---

## 6. AUTOMATION RULES

### 6.1 Rule Types

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Title Contains** | Match if title contains keyword | No |
| **Title Exact Match** | Match if title equals specific text | No |
| **Title Regex** | Match using regular expression pattern | No |
| **Day/Time Rules** | Match by day of week and hour | No |
| **Transcript Keyword** | Match if transcript contains keywords | No |

### 6.2 Rule Actions

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Auto-Assign Tag** | Automatically assign tag when rule matches | No |
| **Auto-Assign Folder** | Automatically assign folder when rule matches | No |
| **Combined Actions** | Assign both tag AND folder from one rule | No |
| **Rule Priority** | Set execution order for rules | No |
| **Enable/Disable Rules** | Toggle rules without deleting | No |
| **Apply Rules to Existing** | Run rules against all existing calls | No |
| **Rule Statistics** | Track how many times each rule applied | No |

---

## 7. EXPORT CAPABILITIES

### 7.1 Individual Call Export

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Export to Markdown** | Single call as .md file | No |
| **Export to PDF** | Single call as formatted PDF | No |
| **Export to DOCX** | Single call as Word document | No |
| **Export to TXT** | Plain text export | No |
| **Export to JSON** | Structured data export | No |
| **Include/Exclude Timestamps** | Toggle timestamps in export | No |

### 7.2 Bulk/Smart Export

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Export Multiple Calls** | Export selected calls together | No |
| **Export by Week** | Organize export by week boundaries | No |
| **Export by Tag** | Organize export by tag assignment | No |
| **Export by Folder** | Organize export by folder assignment | No |
| **ZIP Archive Export** | Export multiple calls as ZIP | No |
| **CSV Export** | Export metadata as spreadsheet | No |
| **AI Summary Generation** | Generate cross-call summary during export | No |
| **Include Options** | Toggle: metadata, participants, transcripts, summaries | No |

---

## 8. AI FEATURES

### 8.1 AI Model Selection

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Multi-Provider Support** | OpenAI, Anthropic, Google, xAI, DeepSeek, Groq | No |
| **15 Model Presets** | Pre-configured model options | No |
| **Save Model Preference** | Remember preferred model | No |

### 8.2 AI Operations

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **AI Title Generation** | Generate descriptive titles from content | No |
| **Bulk Title Generation** | Generate titles for multiple calls | No |
| **Auto-Tagging** | AI suggests tags based on content | No |
| **Bulk Auto-Tagging** | Auto-tag multiple calls at once | No |
| **Meta-Summary Generation** | Generate summary across multiple calls | No |

### 8.3 Knowledge Base / Embeddings

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Transcript Chunking** | Break transcripts into searchable chunks | No |
| **Vector Embeddings** | Generate embeddings for semantic search | No |
| **Embedding Progress Tracking** | Track indexing progress | No |
| **Batch Embedding Jobs** | Background processing of embeddings | No |
| **Index All Transcripts** | One-click index everything | No |
| **Indexing Statistics** | View total chunks, recordings indexed | No |

---

## 9. SETTINGS & CONFIGURATION

### 9.1 Account Settings

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Display Name** | Set user display name | Yes |
| **Host Email** | Configure which email identifies "host" in calls | No |
| **Timezone Selection** | Set timezone for date/time display | No |
| **Password Change** | Change account password | Yes |

### 9.2 Integration Settings

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Fathom API Configuration** | Manage API key and secret | N/A |
| **OAuth Status Display** | See OAuth connection status | N/A |
| **Webhook Configuration** | Set up webhook for auto-sync | N/A |
| **Connection Status Cards** | Visual status of all integrations | N/A |
| **Knowledge Base Stats** | View embedding/indexing stats | N/A |

### 9.3 Setup Wizard

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Guided Setup** | Step-by-step onboarding wizard | N/A |
| **Credentials Step** | Enter API credentials | N/A |
| **OAuth Step** | Connect via OAuth | N/A |
| **Webhook Step** | Configure webhook | N/A |
| **Settings Step** | Configure host email, timezone | N/A |

---

## 10. UI/UX FEATURES

### 10.1 Navigation & Layout

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Tabbed Navigation** | Transcripts, Sync, Analytics tabs | Limited |
| **Collapsible Sidebar** | Folder sidebar with collapse toggle | No |
| **Responsive Design** | Works on mobile and desktop | Yes |
| **Dark/Light Mode** | Theme switcher | Yes |

### 10.2 Feedback & Status

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Toast Notifications** | Success/error feedback messages | Limited |
| **Loading States** | Skeleton loaders during data fetch | Basic |
| **Progress Indicators** | Circular/linear progress for operations | No |
| **Empty States** | Helpful messages when no data | Basic |
| **Confirmation Dialogs** | Confirm destructive actions | Basic |

---

## 11. DEVELOPER / DEBUG FEATURES

### 11.1 Debug Panel

| Feature | Description | Fathom Has? |
|---------|-------------|-------------|
| **Webhook Delivery Viewer** | Inspect incoming webhook payloads | No |
| **Signature Verification Status** | See if webhook signatures validated | No |
| **Request Headers Inspection** | View raw HTTP headers | No |
| **Debug Dump Export** | Export debug info for troubleshooting | No |

---

## SUMMARY: KEY DIFFERENTIATORS FROM FATHOM

### Things CallVault Does That Fathom CANNOT:

| # | Capability | Description |
|---|------------|-------------|
| 1 | **Organization** | Folders with nesting, colors, icons + Tags with colors |
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
|--------|-------|
| **Total Unique Features** | ~95+ |
| **Features Fathom Doesn't Have** | ~85+ |
| **Feature Categories** | 11 |

---

## NOTES

- This document excludes the **Chat** functionality which is under development
- Features marked "N/A" for Fathom indicate integration-specific features that don't apply to Fathom's native interface
- "Basic" or "Limited" indicates Fathom has partial functionality in that area
- "No" indicates Fathom has no equivalent feature

---

*Document generated from codebase analysis on December 11, 2025*
