# Multi-Source Transcript Integration Research

**Date:** 2025-12-04
**Status:** Research Complete
**Confidence Level:** High (Primary sources verified)

---

## Executive Summary

This document outlines the requirements, approaches, and recommendations for expanding Conversion Brain's transcript/recording integration capabilities beyond the current Fathom-only support. The research covers **PLAUD**, **Zoom**, **Apple Voice Memos**, **YouTube**, and **custom video uploads**.

**Key Finding:** PLAUD has a full Developer Platform with SDK/API that can be integrated similarly to Fathom. Other sources will require varying levels of effort, from API integration (Zoom) to manual upload workflows (Voice Memos, custom videos).

---

## Table of Contents

1. [Current Architecture (Fathom Pattern)](#1-current-architecture-fathom-pattern)
2. [PLAUD Integration](#2-plaud-integration)
3. [Zoom Integration](#3-zoom-integration)
4. [Apple Voice Memos](#4-apple-voice-memos)
5. [YouTube Transcripts](#5-youtube-transcripts)
6. [Custom Video/Audio Uploads](#6-custom-videoaudio-uploads)
7. [Recommended Architecture](#7-recommended-architecture)
8. [Implementation Priority & Effort](#8-implementation-priority--effort)
9. [Considerations & Risks](#9-considerations--risks)

---

## 1. Current Architecture (Fathom Pattern)

### How Fathom Integration Works

The existing Fathom integration provides a solid template for future integrations:

| Component | Implementation |
|-----------|----------------|
| **Authentication** | OAuth 2.0 + API Key fallback |
| **Data Sync** | Manual (user-initiated) + Automatic (webhook) |
| **Data Storage** | `fathom_calls` + `fathom_transcripts` tables |
| **Edge Functions** | `fetch-meetings`, `sync-meetings`, `webhook` |
| **Client Library** | `FathomClient` class with retry logic |

### Key Data Structures

```typescript
// Transcript segment structure
interface TranscriptSegment {
  speaker: { display_name: string };
  text: string;
  timestamp: string;  // "00:00:10" format
}

// Call metadata
interface CallRecord {
  recording_id: string;
  title: string;
  created_at: string;
  url: string;
  transcript: TranscriptSegment[];
  summary: string;
  source: 'fathom' | 'plaud' | 'zoom' | 'youtube' | 'upload';
}
```

### Pattern to Replicate

1. **Provider-specific client** in `supabase/functions/_shared/`
2. **Edge Functions** for fetch, sync, and webhook handling
3. **Frontend hooks** (`useMeetingsSync` pattern) for UI integration
4. **Settings tab** for provider configuration

---

## 2. PLAUD Integration

### Overview

**PLAUD** (plaud.ai) is the #1 AI voice recorder brand with 1M+ users. They have a **full Developer Platform** with SDK and API.

**API Documentation:** https://docs.plaud.ai/

### Integration Approach

#### Option A: Full API Integration (Recommended)

PLAUD offers:

| Feature | Description |
|---------|-------------|
| **Device SDK** | Connect PLAUD devices to your app via Bluetooth |
| **Cloud API** | Fetch recordings, transcripts, and summaries |
| **Webhooks** | Get notified when recordings are processed |
| **JSON Output** | Structured transcripts with speaker diarization |
| **Custom Schemas** | Define extraction templates for specific use cases |

**Key API Capabilities:**
- Device management and binding
- File & recording management
- AI Summary extraction
- Custom AI Workflow templates
- 112+ language transcription support
- Automatic speaker diarization

**Authentication:** Request API access via their developer portal form.

#### Data Structure (JSON)

PLAUD provides structured JSON output with:
- Transcription text
- Speaker labels (automatic diarization)
- Timestamps
- Custom schema fields (configurable)

#### Integration Steps

1. **Request API Access**: Submit form at https://docs.google.com/forms/d/e/1FAIpQLSeMr2cRAjrWK79k6HuPOjeOoU7bqHDbk1ZQTsH3RZ8rhJPwAg/viewform
2. **Create Edge Functions**:
   - `plaud-oauth-callback`
   - `fetch-plaud-recordings`
   - `sync-plaud-recordings`
   - `plaud-webhook`
3. **Database Tables**: Create `plaud_calls` and `plaud_transcripts`
4. **Frontend**: Add PLAUD connection in Settings, modify TranscriptsTab

#### Option B: Zapier Integration (Quick Start)

PLAUD now has Zapier integration (beta). Could be used for quick prototyping:
- Trigger: New PLAUD recording
- Action: Send to webhook → Process in Conversion Brain

#### Export Formats (Manual Fallback)

If API access is delayed, PLAUD supports manual export:
- **Audio**: MP3, WAV
- **Transcripts**: Text export (separate from audio)
- **Web app**: https://app.plaud.ai with export options

### Effort Estimate

| Approach | Effort | Timeline |
|----------|--------|----------|
| Full API Integration | High | 2-3 weeks |
| Zapier Bridge | Medium | 1 week |
| Manual Upload Flow | Low | 2-3 days |

### Recommendation

**Start with API integration request immediately.** While waiting for access, implement manual upload flow that accepts PLAUD-exported files.

---

## 3. Zoom Integration

### Overview

Zoom has a comprehensive API for cloud recordings and transcripts.

**API Base URL:** `https://api.zoom.us/v2/`
**Documentation:** https://developers.zoom.us/docs/api/

### Authentication

| Method | Use Case |
|--------|----------|
| **OAuth 2.0** | User authorization for accessing their recordings |
| **Server-to-Server OAuth** | Backend processing without user interaction |

### Key API Endpoints

```
GET /users/{userId}/recordings
GET /meetings/{meetingId}/recordings
GET /recording/download/{downloadToken}  # For VTT transcript files
```

### Transcript Access

Zoom provides transcripts in **VTT format** (WebVTT). Steps to retrieve:

1. List recordings: `GET /users/me/recordings`
2. Find transcript file in recording files array (`file_type: "TRANSCRIPT"`)
3. Download using the `download_url` (requires token)
4. Parse VTT to internal format

### Webhook Events

| Event | Description |
|-------|-------------|
| `recording.completed` | Recording finished processing |
| `recording.transcript_completed` | Transcript ready for download |
| `recording.paused` / `recording.resumed` | Recording state changes |

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ZOOM INTEGRATION                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User connects Zoom account (OAuth)                       │
│     └─► zoom-oauth-callback Edge Function                   │
│                                                              │
│  2. Manual Sync:                                             │
│     └─► fetch-zoom-recordings → list cloud recordings       │
│     └─► sync-zoom-recordings → download + parse VTT         │
│                                                              │
│  3. Automatic Sync (Webhook):                               │
│     └─► zoom-webhook receives recording.completed           │
│     └─► Downloads transcript VTT                            │
│     └─► Parses to internal format                           │
│     └─► Inserts to zoom_calls/zoom_transcripts              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Requirements

- Zoom account with **cloud recording enabled**
- Zoom Pro/Business plan (for transcript feature)
- OAuth app registration in Zoom Marketplace

### Effort Estimate

| Component | Effort |
|-----------|--------|
| OAuth setup | Low (1-2 days) |
| API integration | Medium (3-5 days) |
| VTT parser | Low (1 day) |
| Webhook handler | Medium (2-3 days) |
| **Total** | **1.5-2 weeks** |

---

## 4. Apple Voice Memos

### Overview

Apple Voice Memos does **NOT** have a public API. Integration requires manual or semi-automated approaches.

### Integration Options

#### Option A: Manual Upload (Recommended)

Users export Voice Memos and upload to Conversion Brain:

1. **Export from iOS/macOS**: Voice Memo → Share → Save to Files
2. **Upload in CB**: Drag & drop M4A file
3. **Process**: Transcribe using ASR service (Whisper, AssemblyAI, Deepgram)
4. **Store**: Insert to `uploaded_calls` table

**File Format:** M4A (AAC audio)

#### Option B: iOS Shortcuts Automation

Create iOS Shortcut that:
1. Triggers after Voice Memo recording
2. Uploads to CB webhook endpoint
3. Auto-transcribes and inserts

#### Option C: iCloud Sync Monitoring (Complex)

- Monitor iCloud Drive Voice Memos folder
- Detect new files
- Auto-upload and process

### Transcription Service Needed

Since Voice Memos are raw audio, need ASR:

| Service | Pricing | Quality | Features |
|---------|---------|---------|----------|
| **OpenAI Whisper** | $0.006/min | Excellent | 99+ languages |
| **AssemblyAI** | $0.0042/min | Excellent | Diarization, chapters |
| **Deepgram** | $0.0043/min | Excellent | Real-time option |

### Recommendation

**Implement generic audio upload flow** that:
1. Accepts M4A, MP3, WAV, WEBM
2. Sends to Whisper API for transcription
3. Stores with `source: 'voice_memo'` or `source: 'upload'`

This covers Voice Memos AND any other audio source.

### Effort Estimate

| Component | Effort |
|-----------|--------|
| Upload UI | Low (1-2 days) |
| Whisper integration | Medium (2-3 days) |
| Storage + display | Low (1-2 days) |
| **Total** | **1 week** |

---

## 5. YouTube Transcripts

### Overview

YouTube videos often have auto-generated or manual captions that can be extracted.

### Extraction Methods

#### Option A: youtube-transcript-api (Python)

```python
from youtube_transcript_api import YouTubeTranscriptApi

transcript = YouTubeTranscriptApi.get_transcript(video_id)
# Returns: [{'text': '...', 'start': 0.0, 'duration': 2.5}, ...]
```

**Limitations:**
- Videos must have captions enabled
- Some videos may block transcript access
- Language-specific (can specify preferred language)

#### Option B: YouTube Data API v3

Official Google API for captions:

```
GET /youtube/v3/captions?videoId={id}
GET /youtube/v3/captions/{captionId}
```

**Requirements:**
- API key or OAuth
- Quota limits apply
- Caption download requires OAuth for some content

#### Option C: Third-Party Services

- **youtube-transcript.io** - Free tool
- **AssemblyAI** - YouTube URL support
- **Recall.ai** - Meeting recording API

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  YOUTUBE INTEGRATION                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User pastes YouTube URL in Conversion Brain              │
│                                                              │
│  2. Edge Function: fetch-youtube-transcript                  │
│     └─► Extract video ID from URL                           │
│     └─► Call youtube-transcript-api (or similar)            │
│     └─► Parse timestamps and text                           │
│                                                              │
│  3. Store in youtube_videos / youtube_transcripts            │
│     └─► Include video metadata (title, channel, duration)   │
│                                                              │
│  4. Process like any other transcript                        │
│     └─► Embed chunks for RAG                                │
│     └─► Generate AI summaries                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Considerations

- **Copyright**: User must have right to use the content
- **Rate Limits**: YouTube API has quotas
- **Availability**: Not all videos have transcripts

### Effort Estimate

| Component | Effort |
|-----------|--------|
| URL input UI | Low (1 day) |
| Transcript extraction | Medium (2-3 days) |
| Video metadata fetch | Low (1 day) |
| Storage integration | Low (1-2 days) |
| **Total** | **1 week** |

---

## 6. Custom Video/Audio Uploads

### Overview

Generic upload capability for any video/audio file the user wants to add as knowledge.

### Supported Formats

| Type | Formats | Max Size (Suggested) |
|------|---------|---------------------|
| Audio | MP3, M4A, WAV, WEBM, OGG | 500MB |
| Video | MP4, MOV, WEBM, MKV | 2GB |

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                  UPLOAD PIPELINE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Upload                                                   │
│     └─► Chunked upload to Supabase Storage                  │
│     └─► Progress indicator                                  │
│                                                              │
│  2. Extract Audio (if video)                                 │
│     └─► FFmpeg in Edge Function or external service         │
│     └─► Reduce to audio-only for transcription              │
│                                                              │
│  3. Transcribe                                               │
│     └─► Send to Whisper API (or AssemblyAI/Deepgram)        │
│     └─► Receive timestamped transcript                      │
│                                                              │
│  4. Store                                                    │
│     └─► uploaded_content table                              │
│     └─► uploaded_transcripts table                          │
│     └─► Link to original file in Storage                    │
│                                                              │
│  5. Process                                                  │
│     └─► Embed chunks for RAG                                │
│     └─► Generate AI summary                                 │
│     └─► Extract metadata (duration, format, etc.)           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Edge Function Requirements

| Function | Purpose |
|----------|---------|
| `process-upload` | Orchestrate transcription pipeline |
| `extract-audio` | FFmpeg processing (may need external) |
| `transcribe-audio` | Call Whisper/AssemblyAI API |

### Storage Considerations

- **Supabase Storage**: Good for files up to 50MB (free tier)
- **Large Files**: Consider direct S3 upload with presigned URLs
- **Cleanup**: Auto-delete audio after transcription (keep transcript only)

### Cost Considerations

| Service | Cost | Notes |
|---------|------|-------|
| Whisper API | ~$0.006/min | Most cost-effective |
| Supabase Storage | $0.021/GB | For original files |
| Processing | Varies | FFmpeg compute time |

**Example:** 1-hour video = ~$0.36 transcription + ~$0.02 storage = ~$0.40 total

### Effort Estimate

| Component | Effort |
|-----------|--------|
| Upload UI (drag & drop) | Medium (2-3 days) |
| Chunked upload logic | Medium (2-3 days) |
| Transcription pipeline | Medium (3-4 days) |
| Storage management | Low (1-2 days) |
| Progress/status UI | Low (1-2 days) |
| **Total** | **2-2.5 weeks** |

---

## 7. Recommended Architecture

### Unified Data Model

Create a source-agnostic schema:

```sql
-- Universal content table
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  source TEXT NOT NULL, -- 'fathom', 'plaud', 'zoom', 'youtube', 'upload'
  source_id TEXT, -- External ID from source
  title TEXT NOT NULL,
  description TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  metadata JSONB, -- Source-specific metadata
  UNIQUE(user_id, source, source_id)
);

-- Universal transcript segments
CREATE TABLE transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  speaker TEXT,
  text TEXT NOT NULL,
  start_time_ms INTEGER,
  end_time_ms INTEGER,
  sequence_number INTEGER,
  metadata JSONB
);

-- Content files (for uploads)
CREATE TABLE content_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  file_type TEXT, -- 'original', 'audio', 'transcript'
  storage_path TEXT,
  mime_type TEXT,
  size_bytes BIGINT
);
```

### Provider Interface

```typescript
// Shared interface for all providers
interface ContentProvider {
  name: string;
  fetchContent(userId: string, options?: FetchOptions): Promise<ContentItem[]>;
  syncContent(userId: string, sourceId: string): Promise<SyncResult>;
  handleWebhook?(payload: unknown): Promise<WebhookResult>;
}

// Provider implementations
class FathomProvider implements ContentProvider { ... }
class PlaudProvider implements ContentProvider { ... }
class ZoomProvider implements ContentProvider { ... }
class YouTubeProvider implements ContentProvider { ... }
class UploadProvider implements ContentProvider { ... }
```

### Settings UI Structure

```
Settings
├── Integrations Tab
│   ├── Fathom (existing)
│   │   └── OAuth connect / API key
│   ├── PLAUD (new)
│   │   └── OAuth connect / API key
│   ├── Zoom (new)
│   │   └── OAuth connect
│   └── YouTube (new)
│       └── API key (optional)
│
├── Upload Tab (new)
│   └── Drag & drop zone
│   └── Supported formats info
│   └── Processing queue
```

---

## 8. Implementation Priority & Effort

### Recommended Priority Order

| Priority | Integration | Effort | Value | Reasoning |
|----------|-------------|--------|-------|-----------|
| **1** | Custom Upload | 2-2.5 weeks | High | Enables Voice Memos, any audio/video |
| **2** | PLAUD API | 2-3 weeks | High | Direct competitor to Fathom, great API |
| **3** | YouTube | 1 week | Medium | Easy, adds knowledge base capability |
| **4** | Zoom | 1.5-2 weeks | Medium | Popular but more complex setup |

### Total Estimated Effort

| Phase | Duration |
|-------|----------|
| Phase 1: Upload + YouTube | 3-3.5 weeks |
| Phase 2: PLAUD | 2-3 weeks |
| Phase 3: Zoom | 1.5-2 weeks |
| **Total** | **7-8.5 weeks** |

### Quick Wins (Can Do Immediately)

1. **Request PLAUD API access** (takes time to approve)
2. **Create unified schema** (foundation for all integrations)
3. **Add upload UI placeholder** (set expectations)

---

## 9. Considerations & Risks

### Technical Risks

| Risk | Mitigation |
|------|------------|
| PLAUD API access delay | Start with manual upload, Zapier bridge |
| YouTube transcript unavailable | Graceful error, option to upload manually |
| Large file processing timeout | Use background jobs, chunked processing |
| Whisper API costs | Implement usage limits, user quotas |

### Legal/Compliance

| Concern | Recommendation |
|---------|----------------|
| Content rights | Add disclaimer, user accepts responsibility |
| GDPR/data storage | Delete original files after processing option |
| YouTube ToS | Use official API, respect quotas |

### UX Considerations

1. **Progress visibility**: Show processing status for uploads
2. **Error handling**: Clear messages for failed transcriptions
3. **Source identification**: Visual indicator of content source
4. **Unified search**: All sources searchable together

### Cost Management

| Strategy | Implementation |
|----------|----------------|
| Processing quotas | Limit minutes/month per user |
| Storage limits | Auto-delete originals, keep transcripts |
| Caching | Cache YouTube transcripts to reduce API calls |
| Batch processing | Queue uploads, process in batches |

---

## Appendix A: API Reference Links

| Provider | Documentation |
|----------|---------------|
| PLAUD | https://docs.plaud.ai/ |
| Zoom | https://developers.zoom.us/docs/api/ |
| YouTube Data API | https://developers.google.com/youtube/v3/docs/ |
| youtube-transcript-api | https://pypi.org/project/youtube-transcript-api/ |
| OpenAI Whisper | https://platform.openai.com/docs/guides/speech-to-text |
| AssemblyAI | https://www.assemblyai.com/docs |
| Deepgram | https://developers.deepgram.com/docs |

---

## Appendix B: PLAUD API Request Form

**Submit access request at:**
https://docs.google.com/forms/d/e/1FAIpQLSeMr2cRAjrWK79k6HuPOjeOoU7bqHDbk1ZQTsH3RZ8rhJPwAg/viewform

**Alternative contact for enterprise:**
https://www.plaud.ai/pages/contact-sales

---

## Appendix C: Fathom Integration Reference

The existing Fathom integration provides the architectural template:

| Component | Location |
|-----------|----------|
| Client library | `supabase/functions/_shared/fathom-client.ts` |
| OAuth flow | `supabase/functions/fathom-oauth-*` |
| Fetch meetings | `supabase/functions/fetch-meetings/` |
| Sync meetings | `supabase/functions/sync-meetings/` |
| Webhook handler | `supabase/functions/webhook/` |
| Frontend hook | `src/hooks/useMeetingsSync.ts` |
| Settings UI | `src/components/settings/FathomSetupWizard.tsx` |
| Architecture doc | `docs/architecture/fathom-integration-architecture.md` |

---

**End of Research Document**
