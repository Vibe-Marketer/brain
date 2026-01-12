# YouTube API Setup & Usage Guide

**Last Updated:** 2025-11-25
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [API Keys & Authentication](#api-keys--authentication)
3. [Available APIs](#available-apis)
4. [Usage Methods](#usage-methods)
5. [Rate Limits & Costs](#rate-limits--costs)
6. [Example Use Cases](#example-use-cases)
7. [Supabase Edge Function Integration](#supabase-edge-function-integration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The CallVault project has integrated YouTube API capabilities for video research, transcript extraction, and content analysis. This enables automated research workflows, content analysis pipelines, and integration with Fabric patterns for insights extraction.

### What You Can Do

- **Search YouTube videos** by keyword, channel, or topic
- **Fetch video metadata** (title, description, views, duration, publish date)
- **Extract transcripts** from any YouTube video with timestamps
- **Analyze content** using AI models or Fabric patterns
- **Batch process** multiple videos for comparative analysis
- **Integrate workflows** with n8n, Zapier, or custom Edge Functions

---

## API Keys & Authentication

### Credentials Storage

API keys are stored in multiple secure locations:

1. **Local Development** (`/Users/Naegele/dev/brain/.env.local`):

   ```bash
   YOUTUBE_DATA_API_KEY="YOUR_YOUTUBE_API_KEY"
   TRANSCRIPT_API_KEY="YOUR_TRANSCRIPT_API_KEY"
   ```

2. **Environment Variables** (`/Users/Naegele/dev/brain/.env`):
   - Same keys as above for development environment

3. **Supabase Secrets** (for Edge Functions):

   ```bash
   # Set these in Supabase project settings or via CLI:
   supabase secrets set YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_API_KEY
   supabase secrets set TRANSCRIPT_API_KEY=YOUR_TRANSCRIPT_API_KEY
   ```

4. **Claude Slash Command** (`.claude/commands/youtube.md`):
   - Embedded credentials for Claude Code slash command usage

### Security Notes

- **NEVER commit** API keys to version control
- `.env` and `.env.local` are in `.gitignore`
- Rotate keys immediately if exposed
- Use Supabase secrets for production Edge Functions
- Keys are project-specific, not personal credentials

---

## Available APIs

### 1. YouTube Data API v3

**Provider:** Google Cloud Platform
**Key:** `YOUTUBE_DATA_API_KEY`
**Base URL:** `https://www.googleapis.com/youtube/v3/`

**Capabilities:**

- Search videos, channels, playlists
- Fetch video details (title, description, statistics, duration)
- Get channel information and metadata
- List channel videos with filtering/sorting
- Retrieve video statistics (views, likes, comments)

**Documentation:** <https://developers.google.com/youtube/v3/docs>

### 2. Transcript API

**Provider:** TranscriptAPI.com
**Key:** `TRANSCRIPT_API_KEY`
**Base URL:** `https://transcriptapi.com/api/v2/youtube/transcript`

**Capabilities:**

- Extract full transcripts from YouTube videos
- Optional timestamps for each segment
- Multiple format options (text, JSON, SRT)
- Metadata about transcript availability
- Language detection and translation support

**Documentation:** <https://transcriptapi.com/docs>

---

## Usage Methods

### 1. Claude Slash Command (`/youtube`)

The fastest way to use YouTube APIs directly from Claude Code.

**Location:** `.claude/commands/youtube.md`

**How to Use:**

```bash
# In Claude Code chat
/youtube
```

Then provide your request:

- "Get the latest 5 videos from Alex Hormozi's channel"
- "Fetch transcript for <https://youtube.com/watch?v=VIDEO_ID>"
- "Search for videos about sales objections and summarize the top 3"
- "Get transcripts from these 5 videos and extract key insights"

**Features:**

- Automatic video ID extraction from URLs
- Channel discovery and video listing
- Parallel transcript fetching for batch operations
- Integration with Fabric patterns for analysis
- Formatted output with metadata

**Example Workflow:**

```
User: /youtube Get transcripts from the top 3 videos about "cold email strategies"

Claude will:
1. Search YouTube Data API for relevant videos
2. Present top 3 results with metadata
3. Fetch transcripts using Transcript API
4. Offer to analyze with Fabric patterns (extract_wisdom, sales, etc.)
5. Provide structured output or analysis
```

### 2. Direct API Calls (curl/scripts)

For automation scripts, n8n workflows, or custom integrations.

#### Search Videos

```bash
curl -s "https://www.googleapis.com/youtube/v3/search?\
part=snippet&\
q=sales+training&\
type=video&\
maxResults=10&\
key=${YOUTUBE_DATA_API_KEY}"
```

#### Get Video Details

```bash
curl -s "https://www.googleapis.com/youtube/v3/videos?\
part=snippet,statistics,contentDetails&\
id=VIDEO_ID&\
key=${YOUTUBE_DATA_API_KEY}"
```

#### Get Channel Videos

```bash
curl -s "https://www.googleapis.com/youtube/v3/search?\
part=snippet&\
channelId=CHANNEL_ID&\
type=video&\
order=date&\
maxResults=20&\
key=${YOUTUBE_DATA_API_KEY}"
```

#### Fetch Transcript

```bash
curl -s "https://transcriptapi.com/api/v2/youtube/transcript?\
video_url=VIDEO_ID&\
format=text&\
include_timestamp=false&\
send_metadata=true" \
-H "Authorization: Bearer ${TRANSCRIPT_API_KEY}"
```

**With timestamps:**

```bash
curl -s "https://transcriptapi.com/api/v2/youtube/transcript?\
video_url=VIDEO_ID&\
format=json&\
include_timestamp=true" \
-H "Authorization: Bearer ${TRANSCRIPT_API_KEY}"
```

### 3. Supabase Edge Functions

For production workflows integrated with CallVault database.

**Potential Edge Function:** `fetch-youtube-transcript/` (create as needed)

**Example Implementation:**

```typescript
// supabase/functions/fetch-youtube-transcript/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { videoId, includeMetadata = true } = await req.json();

  const transcriptApiKey = Deno.env.get('TRANSCRIPT_API_KEY');

  const response = await fetch(
    `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${videoId}&format=text&send_metadata=${includeMetadata}`,
    {
      headers: {
        'Authorization': `Bearer ${transcriptApiKey}`,
      },
    }
  );

  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Call from frontend:**

```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase.functions.invoke('fetch-youtube-transcript', {
  body: { videoId: 'dQw4w9WgXcQ', includeMetadata: true },
});
```

### 4. Fabric Patterns Integration

Pipe YouTube transcripts through Fabric for structured analysis.

**Common Patterns:**

- `extract_wisdom` - Extract key insights, quotes, ideas
- `summarize` - Create concise summaries
- `extract_insights` - Pull actionable insights
- `sales` - Analyze sales techniques and strategies
- `deep` - Deep analysis of content themes

**Example Workflow:**

```bash
# Via Claude /youtube command
/youtube

# Claude response:
"I'll fetch the transcript and analyze it. Which Fabric pattern would you like to use?
1. extract_wisdom - Key insights and quotes
2. sales - Sales techniques analysis
3. summarize - Concise summary
4. deep - Deep thematic analysis"

# User selects, Claude pipes transcript through fabric:
curl -s "https://transcriptapi.com/api/v2/youtube/transcript?video_url=VIDEO_ID&format=text" \
  -H "Authorization: Bearer ${TRANSCRIPT_API_KEY}" | \
  fabric --pattern extract_wisdom
```

**Manual Pipeline:**

```bash
# Get transcript
TRANSCRIPT=$(curl -s "https://transcriptapi.com/api/v2/youtube/transcript?video_url=dQw4w9WgXcQ&format=text&include_timestamp=false" \
  -H "Authorization: Bearer ${TRANSCRIPT_API_KEY}" | jq -r '.text')

# Analyze with Fabric
echo "$TRANSCRIPT" | fabric --pattern sales --model gpt-4o

# Or save for later
echo "$TRANSCRIPT" > video_transcript.txt
cat video_transcript.txt | fabric --pattern extract_wisdom
```

---

## Rate Limits & Costs

### YouTube Data API v3

**Free Tier:**

- **10,000 quota units per day** (per project)
- Most operations cost 1-100 units
- Search: 100 units per request
- Video details: 1 unit per request
- Channel list: 1 unit per request

**Cost Breakdown:**

- Search for 10 videos: 100 units (100 searches/day max)
- Get 100 video details: 100 units
- **Daily limit:** ~100 searches OR ~10,000 video detail fetches

**Exceeding Limits:**

- Free tier limits are daily quotas
- Paid tier: $0.20 per 10,000 additional quota units
- Typical monthly cost: $0-5 for moderate usage

**Best Practices:**

- Cache video metadata to reduce API calls
- Batch requests where possible
- Use `maxResults` parameter efficiently
- Monitor quota in Google Cloud Console

**Quota Reset:** Midnight Pacific Time (PST/PDT)

### Transcript API

**Plan:** Based on key `YOUR_TRANSCRIPT_API_KEY`
**Tier:** Likely Pro/Enterprise (based on key format)

**Estimated Limits:**

- Pro Plan: ~1,000-5,000 transcripts/month
- Enterprise: 10,000+ transcripts/month
- Rate limiting: ~10-30 requests/minute

**Cost:**

- Pro: $29-99/month (estimated)
- Enterprise: Custom pricing
- Overage: $0.01-0.05 per transcript

**Response Times:**

- Typical: 1-3 seconds per transcript
- Long videos (>2 hours): 5-10 seconds
- Cached transcripts: <1 second

**Best Practices:**

- Check transcript availability before fetching (metadata endpoint)
- Cache transcripts locally to avoid refetching
- Respect rate limits (implement exponential backoff)
- Use batch operations for multiple videos

---

## Example Use Cases

### 1. Competitive Sales Research

**Goal:** Analyze top 10 sales training videos for common techniques

**Workflow:**

1. Search YouTube for "B2B sales objection handling"
2. Fetch top 10 video transcripts
3. Run through `fabric --pattern sales`
4. Extract common patterns and techniques
5. Store insights in CallVault database

**Implementation:**

```bash
/youtube Search for "B2B sales objection handling" top 10 videos, get transcripts, and analyze with Fabric sales pattern
```

### 2. Channel Content Audit

**Goal:** Audit all videos from a competitor's channel

**Workflow:**

1. Get channel ID from channel URL
2. Fetch all videos (paginated)
3. Extract transcripts for each
4. Categorize by topic/theme
5. Identify content gaps

**Implementation:**

```bash
/youtube Get all videos from [CHANNEL_URL], fetch transcripts, and categorize by primary topic
```

### 3. Customer Research

**Goal:** Understand what customers are saying about your product

**Workflow:**

1. Search for "[Product Name] review"
2. Fetch transcripts from review videos
3. Analyze sentiment and common themes
4. Extract feature requests and pain points

**Implementation:**

```bash
/youtube Search for "Fathom AI review" videos, get transcripts, and extract key feedback themes
```

### 4. Content Strategy Planning

**Goal:** Identify trending topics in your niche

**Workflow:**

1. Search multiple keywords related to niche
2. Analyze view counts, engagement metrics
3. Fetch transcripts from high-performing videos
4. Identify content patterns that drive engagement

**Implementation:**

```bash
/youtube Search for these topics: ["sales enablement", "revenue operations", "sales coaching"], analyze top 5 for each, and identify common themes
```

### 5. Training Material Creation

**Goal:** Create training docs from expert videos

**Workflow:**

1. Curate list of expert videos
2. Fetch transcripts with timestamps
3. Extract key concepts using Fabric `extract_wisdom`
4. Organize into training modules
5. Store in CallVault knowledge base

**Implementation:**

```bash
/youtube Get transcripts from these videos: [URL1, URL2, URL3], extract wisdom, and structure as training outline
```

### 6. Automated Content Curation

**Goal:** Daily digest of new videos from favorite channels

**Workflow:**

1. Schedule n8n workflow to run daily
2. Check subscribed channels for new videos (last 24h)
3. Fetch transcripts for new uploads
4. Summarize key points
5. Email digest with summaries

**n8n Integration:**

```
Trigger: Schedule (daily 9am)
→ HTTP Request: YouTube Data API (get channel videos, publishedAfter=yesterday)
→ Loop: For each new video
  → HTTP Request: Transcript API
  → AI: Summarize transcript (GPT-4o)
→ Aggregate: Combine summaries
→ Send Email: Daily digest
```

---

## Supabase Edge Function Integration

### Setting Up Secrets

**To use YouTube APIs in Supabase Edge Functions, set secrets:**

```bash
# Navigate to project root
cd /Users/Naegele/dev/brain

# Set YouTube Data API key
supabase secrets set YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_API_KEY

# Set Transcript API key
supabase secrets set TRANSCRIPT_API_KEY=YOUR_TRANSCRIPT_API_KEY

# Verify secrets are set
supabase secrets list
```

**Expected Output:**

```
NAME                       VALUE
YOUTUBE_DATA_API_KEY       AIzaSyB***q75E
TRANSCRIPT_API_KEY         sk_qIg***NGr0
```

### Creating a YouTube Transcript Edge Function

**File:** `supabase/functions/fetch-youtube-data/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { videoId, action = 'transcript' } = await req.json();

    if (!videoId) {
      throw new Error('videoId is required');
    }

    const youtubeApiKey = Deno.env.get('YOUTUBE_DATA_API_KEY');
    const transcriptApiKey = Deno.env.get('TRANSCRIPT_API_KEY');

    let result;

    if (action === 'metadata') {
      // Fetch video metadata
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${youtubeApiKey}`
      );
      result = await response.json();
    } else if (action === 'transcript') {
      // Fetch transcript
      const response = await fetch(
        `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${videoId}&format=text&send_metadata=true`,
        {
          headers: {
            'Authorization': `Bearer ${transcriptApiKey}`,
          },
        }
      );
      result = await response.json();
    } else {
      throw new Error('Invalid action. Use "metadata" or "transcript"');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Deploy:**

```bash
supabase functions deploy fetch-youtube-data
```

**Call from frontend:**

```typescript
import { supabase } from '@/lib/supabase';

// Get transcript
const { data: transcript } = await supabase.functions.invoke(
  'fetch-youtube-data',
  { body: { videoId: 'dQw4w9WgXcQ' } }
);

// Get metadata
const { data: metadata } = await supabase.functions.invoke(
  'fetch-youtube-data',
  { body: { videoId: 'dQw4w9WgXcQ', action: 'metadata' } }
);
```

---

## Troubleshooting

### Common Issues

#### "Invalid API Key"

- Verify key is correct in `.env.local`
- Check that key hasn't been revoked in Google Cloud Console
- Ensure key is set for YouTube Data API v3

#### "Quota Exceeded"

- Check current quota usage in Google Cloud Console
- Wait for daily reset (midnight PST/PDT)
- Optimize requests to use fewer quota units
- Consider enabling paid quota

#### "Transcript Not Available"

- Not all YouTube videos have transcripts
- Check Transcript API documentation for supported languages
- Verify video ID is correct
- Some videos may have disabled transcript access

#### "CORS Error in Browser"

- Ensure Supabase Edge Function is properly deployed
- Check CORS headers in Edge Function response
- Verify frontend is calling the correct endpoint

#### Rate Limiting (429 errors)

- Implement exponential backoff in retry logic
- Reduce request frequency
- Check rate limits for both APIs

### Getting Help

- YouTube Data API: <https://developers.google.com/youtube/v3/docs>
- Transcript API: <https://transcriptapi.com/docs>
- Supabase: <https://supabase.com/docs>
- Check API error responses for specific error details