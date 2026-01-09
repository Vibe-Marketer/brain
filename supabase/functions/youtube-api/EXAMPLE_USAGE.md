# YouTube API Usage Examples

Quick reference for testing and using the YouTube API Edge Function.

## Testing with curl

### 1. Search Videos

```bash
curl -X POST 'http://localhost:54321/functions/v1/youtube-api' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "search",
    "params": {
      "query": "TypeScript tutorial",
      "maxResults": 5
    }
  }'
```

### 2. Get Channel Videos

```bash
curl -X POST 'http://localhost:54321/functions/v1/youtube-api' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "channel-videos",
    "params": {
      "channelId": "UCW5YeuERMmlnqo4oq8vwUpg",
      "maxResults": 10
    }
  }'
```

### 3. Get Video Details

```bash
curl -X POST 'http://localhost:54321/functions/v1/youtube-api' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "video-details",
    "params": {
      "videoId": "dQw4w9WgXcQ"
    }
  }'
```

### 4. Get Single Transcript

```bash
curl -X POST 'http://localhost:54321/functions/v1/youtube-api' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "transcript",
    "params": {
      "videoId": "dQw4w9WgXcQ"
    }
  }'
```

### 5. Get Batch Transcripts

```bash
curl -X POST 'http://localhost:54321/functions/v1/youtube-api' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "batch-transcripts",
    "params": {
      "videoIds": ["dQw4w9WgXcQ", "jNQXAC9IVRw", "9bZkp7q19f0"]
    }
  }'
```

## Testing with TypeScript/React

### Basic Component Example

```tsx
import { useState } from 'react';
import {
  searchYouTubeVideos,
  getVideoDetails,
  getVideoTranscript,
  type YouTubeVideo
} from '@/lib/api-client';

export function YouTubeSearch() {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await searchYouTubeVideos(query, 10);

    if (apiError) {
      setError(apiError);
    } else if (data) {
      setVideos(data.videos);
    }

    setLoading(false);
  };

  const handleGetTranscript = async (videoId: string) => {
    const { data, error } = await getVideoTranscript(videoId);

    if (error) {
      console.error('Transcript error:', error);
      return;
    }

    console.log('Transcript:', data?.transcript);
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search YouTube..."
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>

      {error && <div className="error">{error}</div>}

      <div className="results">
        {videos.map((video) => (
          <div key={video.videoId}>
            <h3>{video.title}</h3>
            <p>{video.channelTitle}</p>
            <button onClick={() => handleGetTranscript(video.videoId)}>
              Get Transcript
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Batch Processing Example

```typescript
import { getBatchTranscripts } from '@/lib/api-client';

async function processMultipleVideos(videoIds: string[]) {
  // Fetch transcripts in parallel
  const { data, error } = await getBatchTranscripts(videoIds);

  if (error) {
    console.error('Batch error:', error);
    return;
  }

  if (data) {
    console.log(`Successfully fetched ${data.successCount} transcripts`);
    console.log(`Failed to fetch ${data.failureCount} transcripts`);

    // Process successful transcripts
    data.transcripts.forEach((transcript) => {
      console.log(`Video ${transcript.videoId}: ${transcript.transcript.substring(0, 100)}...`);
    });

    // Handle errors
    data.errors.forEach((err) => {
      console.error(`Video ${err.videoId} failed: ${err.error}`);
    });
  }
}
```

### Channel Video Import Example

```typescript
import { getChannelVideos, getBatchTranscripts } from '@/lib/api-client';

async function importChannelVideos(channelId: string) {
  // Step 1: Get all videos from channel
  const { data: channelData, error: channelError } = await getChannelVideos(
    channelId,
    50
  );

  if (channelError || !channelData) {
    console.error('Failed to fetch channel videos:', channelError);
    return;
  }

  console.log(`Found ${channelData.videos.length} videos`);

  // Step 2: Extract video IDs
  const videoIds = channelData.videos.map((v) => v.videoId);

  // Step 3: Fetch all transcripts in batch
  const { data: transcriptData, error: transcriptError } = await getBatchTranscripts(
    videoIds
  );

  if (transcriptError || !transcriptData) {
    console.error('Failed to fetch transcripts:', transcriptError);
    return;
  }

  // Step 4: Process results
  console.log(`Successfully imported ${transcriptData.successCount} transcripts`);

  return {
    videos: channelData.videos,
    transcripts: transcriptData.transcripts,
    errors: transcriptData.errors,
  };
}
```

## Environment Setup

For local development with Supabase CLI:

1. Create `.env` file in your project root (or use Supabase secrets):

```env
YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_API_KEY
TRANSCRIPT_API_KEY=YOUR_TRANSCRIPT_API_KEY
```

2. Set secrets via Supabase CLI:

```bash
supabase secrets set YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_API_KEY
supabase secrets set TRANSCRIPT_API_KEY=YOUR_TRANSCRIPT_API_KEY
```

3. Or set in Supabase Dashboard:
   - Go to Project Settings > Edge Functions
   - Add environment variables

## Common Use Cases

### 1. Content Research
Search for videos on a topic and analyze their transcripts for research.

### 2. Channel Analysis
Get all videos from a channel and analyze content patterns.

### 3. Video Metadata Extraction
Extract statistics, tags, and metadata for content analysis.

### 4. Transcript Indexing
Fetch transcripts for search/RAG applications.

### 5. Batch Processing
Process multiple videos efficiently with parallel transcript fetching.

## Error Handling Best Practices

```typescript
async function safeYouTubeSearch(query: string) {
  try {
    const { data, error } = await searchYouTubeVideos(query);

    if (error) {
      // Handle API error
      if (error.includes('Quota exceeded')) {
        // Show user-friendly message about rate limits
        return { error: 'YouTube API quota exceeded. Please try again tomorrow.' };
      }
      if (error.includes('Invalid API key')) {
        // Log for admin
        console.error('YouTube API key configuration issue');
        return { error: 'Service temporarily unavailable' };
      }
      return { error };
    }

    return { data };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred' };
  }
}
```

## Performance Tips

1. **Batch Operations**: Use `getBatchTranscripts` for multiple videos instead of sequential calls
2. **Caching**: Cache video details and transcripts to avoid redundant API calls
3. **Pagination**: Use `maxResults` parameter to limit data transfer
4. **Error Recovery**: Handle partial failures in batch operations gracefully
5. **Rate Limits**: Monitor YouTube API quota usage in Google Cloud Console
