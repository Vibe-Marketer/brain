# YouTube Research & Transcript Tool

You have access to YouTube APIs for video research and transcript extraction.

## API Credentials (stored securely)

```
YOUTUBE_DATA_API_KEY: AIzaSyB-5OHLyCWibnpkO5-cIUh5ZBvsdCAq75E
TRANSCRIPT_API_KEY: sk_qIg9PTc9bkTSPbsWK-y-p455ljszZ-M6GMMHijsNGr0
```

## Available Operations

### 1. Search Videos
```bash
curl -s "https://www.googleapis.com/youtube/v3/search?part=snippet&q={QUERY}&type=video&maxResults={COUNT}&key={YOUTUBE_DATA_API_KEY}"
```

### 2. Get Channel Videos
```bash
# First get channel ID from channel URL/name
curl -s "https://www.googleapis.com/youtube/v3/search?part=snippet&channelId={CHANNEL_ID}&type=video&maxResults={COUNT}&order=date&key={YOUTUBE_DATA_API_KEY}"
```

### 3. Get Video Details
```bash
curl -s "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id={VIDEO_ID}&key={YOUTUBE_DATA_API_KEY}"
```

### 4. Get Transcript
```bash
curl -s "https://transcriptapi.com/api/v2/youtube/transcript?video_url={VIDEO_ID}&format=text&include_timestamp=false&send_metadata=true" \
  -H "Authorization: Bearer {TRANSCRIPT_API_KEY}"
```

## User Request Handling

When the user provides a YouTube-related request, determine what they need:

### Channel Research
1. If given channel URL → Extract channel ID or username
2. Use search API with channelId to list videos
3. Present list with titles, dates, view counts
4. Ask which videos to get transcripts for (or batch fetch)

### Video Search
1. Use search API with query
2. Present top results
3. Offer to fetch transcripts

### Single Video Transcript
1. Extract video ID from URL (11-char code after `v=` or after `youtu.be/`)
2. Fetch transcript with metadata
3. Present or analyze as requested

### Batch Transcript Fetch
1. For multiple videos, fetch transcripts in parallel
2. Combine results for analysis

## Analysis Options

After fetching transcripts, offer to:
- **Summarize**: Key points and takeaways
- **Extract insights**: Wisdom, patterns, actionable items
- **Compare**: Find common themes across multiple videos
- **Search**: Find specific topics within transcripts
- **Feed to Fabric**: Use patterns like `sales`, `wisdom`, `hw`, `deep`

## Example Workflows

### "Get Alex Hormozi's latest videos"
1. Search for channel: `https://www.googleapis.com/youtube/v3/search?part=snippet&q=Alex+Hormozi&type=channel&key={KEY}`
2. Get channel ID from result
3. List recent videos: `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId={ID}&type=video&order=date&maxResults=10&key={KEY}`
4. Present list, offer transcript fetching

### "Summarize this video: [URL]"
1. Extract video ID
2. Fetch transcript with metadata
3. Provide summary or run through analysis

### "Find videos about sales objections and extract key techniques"
1. Search: `q=sales+objections+handling`
2. Get top 5-10 results
3. Fetch transcripts in parallel
4. Analyze for patterns and techniques

## Output Format

When presenting video lists:
```
1. [TITLE] (DATE)
   Views: X | Duration: Y
   ID: VIDEO_ID

2. [TITLE] (DATE)
   ...
```

When presenting transcripts:
```
## [Video Title]
**Channel**: Author Name
**Published**: Date
**Duration**: X:XX

### Transcript
[Full text or summary based on request]
```
