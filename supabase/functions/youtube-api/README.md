# YouTube API Edge Function

Provides YouTube integration functionality including video search, channel videos, video details, and transcript fetching.

## Features

- **Search Videos**: Search YouTube by query string
- **Channel Videos**: Get recent videos from a specific channel
- **Video Details**: Get detailed metadata for a video (views, likes, duration, etc.)
- **Transcript**: Get transcript for a single video
- **Batch Transcripts**: Get transcripts for multiple videos in parallel

## Environment Variables

Required environment variables (configure in Supabase Dashboard):

```
YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_API_KEY
TRANSCRIPT_API_KEY=YOUR_TRANSCRIPT_API_KEY
```

## API Endpoints

### Search Videos

```typescript
POST /youtube-api
{
  "action": "search",
  "params": {
    "query": "TypeScript tutorial",
    "maxResults": 10  // optional, defaults to 10
  }
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "videos": [
      {
        "videoId": "abc123",
        "title": "TypeScript Basics",
        "description": "Learn TypeScript...",
        "channelId": "UC...",
        "channelTitle": "CodeChannel",
        "publishedAt": "2024-01-15T10:00:00Z",
        "thumbnails": { ... }
      }
    ],
    "totalResults": 1000000,
    "nextPageToken": "CAUQAA"
  }
}
```

### Get Channel Videos

```typescript
POST /youtube-api
{
  "action": "channel-videos",
  "params": {
    "channelId": "UC...",
    "maxResults": 25  // optional, defaults to 25
  }
}
```

### Get Video Details

```typescript
POST /youtube-api
{
  "action": "video-details",
  "params": {
    "videoId": "abc123"
  }
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "videoId": "abc123",
    "title": "Video Title",
    "description": "Full description...",
    "channelId": "UC...",
    "channelTitle": "Channel Name",
    "publishedAt": "2024-01-15T10:00:00Z",
    "thumbnails": { ... },
    "tags": ["typescript", "tutorial"],
    "categoryId": "27",
    "duration": "PT10M30S",
    "definition": "hd",
    "caption": "true",
    "viewCount": 50000,
    "likeCount": 1200,
    "commentCount": 150
  }
}
```

### Get Transcript

```typescript
POST /youtube-api
{
  "action": "transcript",
  "params": {
    "videoId": "abc123"
  }
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "videoId": "abc123",
    "transcript": "Full transcript text...",
    "language": "en",
    "duration": 630
  }
}
```

### Get Batch Transcripts

```typescript
POST /youtube-api
{
  "action": "batch-transcripts",
  "params": {
    "videoIds": ["abc123", "def456", "ghi789"]
  }
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "transcripts": [
      {
        "videoId": "abc123",
        "transcript": "...",
        "language": "en",
        "duration": 630
      },
      {
        "videoId": "def456",
        "transcript": "...",
        "language": "en",
        "duration": 480
      }
    ],
    "errors": [
      {
        "videoId": "ghi789",
        "error": "Transcript not available"
      }
    ],
    "totalRequested": 3,
    "successCount": 2,
    "failureCount": 1
  }
}
```

## Usage from Frontend

Use the typed API client functions in `src/lib/api-client.ts`:

```typescript
import {
  searchYouTubeVideos,
  getChannelVideos,
  getVideoDetails,
  getVideoTranscript,
  getBatchTranscripts
} from '@/lib/api-client';

// Search videos
const { data, error } = await searchYouTubeVideos('React hooks', 20);

// Get channel videos
const { data, error } = await getChannelVideos('UC...', 50);

// Get video details
const { data, error } = await getVideoDetails('abc123');

// Get single transcript
const { data, error } = await getVideoTranscript('abc123');

// Get batch transcripts
const { data, error } = await getBatchTranscripts(['abc123', 'def456']);
```

## Authentication

All endpoints require user authentication via JWT token in the Authorization header.

## Error Handling

Errors are returned with `success: false` and an `error` message:

```typescript
{
  "success": false,
  "error": "YouTube API error: 403 - Quota exceeded"
}
```

Common errors:
- Missing/invalid API keys
- YouTube API quota exceeded
- Video not found
- Transcript not available
- Invalid parameters

## Rate Limits

- YouTube Data API: 10,000 quota units per day
- Search costs 100 units per request
- Video details costs 1 unit per request
- Plan accordingly for batch operations

## Notes

- Transcript API uses third-party service (youdotcom)
- Batch transcript fetching uses parallel requests with Promise.allSettled
- Failed transcripts in batch operations return partial results with error details
- All responses include CORS headers for browser access
