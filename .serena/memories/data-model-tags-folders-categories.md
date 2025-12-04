# Conversion Brain - Tags, Folders & Categories Data Model

## Overview
The application uses TWO different organizational systems for transcript calls:

### 1. Tags (`call_tags` table)
- **Purpose**: User-created labels for categorizing transcripts
- **UI Location**: Main TranscriptsTab (library view)
- **Table**: `call_tags` - stores tag definitions (id, name, user_id)
- **Assignments**: `call_tag_assignments` - stores which calls have which tags (call_recording_id, tag_id)
- **Props in TranscriptTable**:
  - `tags: Array<{ id: string; name: string }>` - available tags
  - `tagAssignments: Record<string, string[]>` - mapping of recording_id to array of tag IDs

### 2. Folders
- **Purpose**: Another organizational hierarchy for transcripts
- **UI Location**: Main TranscriptsTab (library view)
- **Props in TranscriptTable**:
  - `folders?: Folder[]` - available folders (id, name, color, icon)
  - `folderAssignments?: Record<string, string[]>` - mapping of recording_id to folder IDs

### 3. Categories (Sync Tab)
- **Purpose**: Used in the SyncTab for categorizing unsynced/synced meetings
- **Source**: Uses `useCategorySync` hook which loads from `call_tags` table
- **IMPORTANT**: Categories in SyncTab ARE the same as Tags - same database table
- **Mapping**: When passing to TranscriptTable, use `tags` and `tagAssignments` props

## Common Bug Pattern (FIXED 2025-12-04)
**Problem**: SyncTab components incorrectly passed `categories` and `categoryAssignments` props
to TranscriptTable, but TranscriptTable expects `tags` and `tagAssignments`.

**Symptom**: "Cannot read properties of undefined (reading 'RECORDING_ID')" error
when accessing `tagAssignments[call.recording_id]` where tagAssignments is undefined
because the prop wasn't mapped correctly.

**Solution**: In SyncedTranscriptsSection and UnsyncedMeetingsSection, map:
- `categories` → `tags`
- `categoryAssignments` → `tagAssignments`

## Component Hierarchy

```
TranscriptsTab.tsx (Library)
  └── TranscriptTable (tags, tagAssignments, folders, folderAssignments)
        └── TranscriptTableRow (tags, tagAssignments[], folders, folderAssignments[])

SyncTab.tsx
  ├── UnsyncedMeetingsSection
  │     └── TranscriptTable (tags=categories, tagAssignments={})
  └── SyncedTranscriptsSection  
        └── TranscriptTable (tags=categories, tagAssignments=categoryAssignments)
```

## Key Files
- `src/components/transcript-library/TranscriptTable.tsx` - Main table component
- `src/components/transcript-library/TranscriptTableRow.tsx` - Row component
- `src/components/transcripts/SyncTab.tsx` - Sync tab parent
- `src/components/transcripts/UnsyncedMeetingsSection.tsx` - Unsynced meetings
- `src/components/transcripts/SyncedTranscriptsSection.tsx` - Synced transcripts
- `src/hooks/useCategorySync.ts` - Category/tag sync hook

## Database Tables
- `call_tags` - Tag definitions (shared by categories in Sync tab)
- `call_tag_assignments` - Tag-to-call mappings
- `call_folders` - Folder definitions  
- `call_folder_assignments` - Folder-to-call mappings
