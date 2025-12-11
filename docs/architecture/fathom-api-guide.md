# **Fathom API TypeScript Guide for Lovable**

**Purpose:** Complete TypeScript-only reference for building the Fathom-to-Supabase sync application in Lovable.

---

## Table of Contents

1. [Quick Start](#quick-start)  
2. [TypeScript SDK Setup](#typescript-sdk-setup)  
3. [Authentication](#authentication)  
4. [API Endpoints](#api-endpoints)  
5. [Pagination](#pagination)  
6. [Error Handling](#error-handling)  
7. [Webhooks](#webhooks)  
8. [Rate Limiting](#rate-limiting)  
9. [Complete Code Examples](#complete-code-examples)

---

## Quick Start

### Installation

npm install fathom-typescript

### Basic Usage

import { Fathom } from 'fathom-typescript';

const fathom \= new Fathom({

  security: {

    apiKeyAuth: process.env.FATHOM\_API\_KEY

  }

});

// Fetch meetings

const result \= await fathom.listMeetings({});

---

## TypeScript SDK Setup

### Environment Variables

FATHOM\_API\_KEY=your\_api\_key\_here

### Initialize Client

import { Fathom } from 'fathom-typescript';

// Create reusable client instance

const fathom \= new Fathom({

  security: {

    apiKeyAuth: process.env.FATHOM\_API\_KEY\!

  }

});

export default fathom;

---

## Authentication

### API Key Authentication

**How to Get Your API Key:**

1. Log in to Fathom  
2. Go to Settings → User Settings  
3. Find "API Access" section  
4. Click "Generate API Key"  
5. Copy and store securely

**Usage:**

import { Fathom } from 'fathom-typescript';

const fathom \= new Fathom({

  security: {

    apiKeyAuth: process.env.FATHOM\_API\_KEY\!

  }

});

**Validate API Key:**

async function validateApiKey(apiKey: string): Promise\<boolean\> {

  try {

    const fathom \= new Fathom({

      security: { apiKeyAuth: apiKey }

    });

    

    await fathom.listMeetings({});

    return true;

  } catch (error) {

    return false;

  }

}

---

## API Endpoints

### Base URL

https://api.fathom.ai/external/v1/

### List Meetings

**Method:** `listMeetings()`

**Parameters:**

| Parameter | Type | Description |
| :---- | :---- | :---- |
| `calendarInvitees` | `string[]` | Filter by invitee email addresses |
| `calendarInviteesDomains` | `string[]` | Filter by company domains |
| `calendarInviteesDomainType` | `enum` | `all`, `only_internal`, `one_or_more_external` |
| `createdAfter` | `string` | ISO 8601 timestamp (e.g., "2025-01-01T00:00:00Z") |
| `createdBefore` | `string` | ISO 8601 timestamp |
| `cursor` | `string` | Pagination cursor from previous response |
| `includeActionItems` | `boolean` | Include action items (default: false) |
| `includeCrmMatches` | `boolean` | Include CRM matches (default: false) |
| `includeSummary` | `boolean` | Include AI summary (default: false) |
| `includeTranscript` | `boolean` | Include full transcript (default: false) |
| `meetingType` | `enum` | `all`, `external`, `internal` |
| `recordedBy` | `string[]` | Filter by recorder email |
| `teams` | `string[]` | Filter by team names |

**Example:**

// Fetch meetings with transcripts from last 30 days

const thirtyDaysAgo \= new Date();

thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() \- 30);

const result \= await fathom.listMeetings({

  createdAfter: thirtyDaysAgo.toISOString(),

  includeTranscript: true,

  includeSummary: true

});

**Response Structure:**

interface MeetingResponse {

  limit: number;

  next\_cursor: string | null;

  items: Meeting\[\];

}

interface Meeting {

  title: string;

  meeting\_title: string;

  recording\_id: number;

  url: string;

  share\_url: string;

  created\_at: string;

  scheduled\_start\_time: string;

  scheduled\_end\_time: string;

  recording\_start\_time: string;

  recording\_end\_time: string;

  calendar\_invitees\_domains\_type: string;

  transcript\_language: string;

  calendar\_invitees?: CalendarInvitee\[\];

  recorded\_by?: RecordedBy;

  transcript?: TranscriptSegment\[\];

  default\_summary?: Summary;

  action\_items?: ActionItem\[\];

  crm\_matches?: CrmMatches;

}

interface TranscriptSegment {

  speaker: {

    display\_name: string;

    matched\_calendar\_invitee\_email?: string;

  };

  text: string;

  timestamp: string; // Format: "00:05:32"

}

interface CalendarInvitee {

  name: string;

  email: string;

  external: boolean;

}

interface RecordedBy {

  name: string;

  email: string;

  team?: string;

}

interface Summary {

  template\_name: string;

  markdown\_formatted: string;

}

interface ActionItem {

  description: string;

  assignee?: {

    name: string;

    email: string;

  };

  completed: boolean;

  playback\_url: string;

}

### Get Transcript

**Direct API Call (if needed):**

async function getTranscript(recordingId: number): Promise\<TranscriptSegment\[\]\> {

  const response \= await fetch(

    \`https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript\`,

    {

      headers: {

        'X-Api-Key': process.env.FATHOM\_API\_KEY\!

      }

    }

  );


  if (\!response.ok) {

    throw new Error(\`Failed to fetch transcript: ${response.statusText}\`);

  }


  const data \= await response.json();

  return data.transcript;

}

**Note:** It's easier to use `includeTranscript: true` in `listMeetings()`.

### Get Summary

async function getSummary(recordingId: number): Promise\<Summary\> {

  const response \= await fetch(

    \`https://api.fathom.ai/external/v1/recordings/${recordingId}/summary\`,

    {

      headers: {

        'X-Api-Key': process.env.FATHOM\_API\_KEY\!

      }

    }

  );


  if (\!response.ok) {

    throw new Error(\`Failed to fetch summary: ${response.statusText}\`);

  }


  const data \= await response.json();

  return data.summary;

}

### List Teams

const teams \= await fathom.listTeams({});

// Response

interface TeamResponse {

  limit: number;

  next\_cursor: string | null;

  items: Team\[\];

}

interface Team {

  name: string;

  created\_at: string;

}

### List Team Members

const members \= await fathom.listTeamMembers({

  team: "Sales"

});

// Response

interface TeamMemberResponse {

  limit: number;

  next\_cursor: string | null;

  items: TeamMember\[\];

}

interface TeamMember {

  name: string;

  email: string;

  created\_at: string;

}

---

## Pagination

### Automatic Pagination (Recommended)

// Using async iteration

const result \= await fathom.listMeetings({

  includeTranscript: true

});

const allMeetings: Meeting\[\] \= \[\];

for await (const page of result) {

  if (page.items) {

    allMeetings.push(...page.items);

    console.log(\`Fetched ${allMeetings.length} meetings so far...\`);

  }

}

console.log(\`Total meetings: ${allMeetings.length}\`);

### Manual Pagination

async function getAllMeetings() {

  let cursor: string | undefined \= undefined;

  const allMeetings: Meeting\[\] \= \[\];


  do {

    const response \= await fathom.listMeetings({

      cursor,

      includeTranscript: true

    });

    

    if (response.items) {

      allMeetings.push(...response.items);

    }

    

    cursor \= response.next\_cursor || undefined;

    

    console.log(\`Fetched ${allMeetings.length} meetings...\`);

  } while (cursor);


  return allMeetings;

}

### Incremental Processing (Memory Efficient)

async function processMeetingsIncrementally(

  processor: (meeting: Meeting) \=\> Promise\<void\>

) {

  const result \= await fathom.listMeetings({

    includeTranscript: true

  });


  for await (const page of result) {

    if (page.items) {

      for (const meeting of page.items) {

        await processor(meeting);

      }

    }

  }

}

// Usage

await processMeetingsIncrementally(async (meeting) \=\> {

  // Insert into Supabase

  await supabase.from('fathom\_calls').insert({

    recording\_id: meeting.recording\_id,

    title: meeting.title,

    created\_at: meeting.created\_at,

    url: meeting.url

  });

});

---

## Error Handling

### Import Error Types

import { Fathom } from 'fathom-typescript';

import \* as errors from 'fathom-typescript/models/errors';

### Basic Error Handling

try {

  const result \= await fathom.listMeetings({});

  // Process result

} catch (error) {

  if (error instanceof errors.FathomError) {

    console.error('Status:', error.statusCode);

    console.error('Message:', error.message);

    console.error('Body:', error.body);

  } else {

    console.error('Unexpected error:', error);

  }

}

### Handle Specific Status Codes

async function fetchMeetingsWithErrorHandling() {

  try {

    return await fathom.listMeetings({

      includeTranscript: true

    });

  } catch (error) {

    if (error instanceof errors.FathomError) {

      switch (error.statusCode) {

        case 401:

          throw new Error('Invalid API key. Please check your credentials.');

        case 403:

          throw new Error('Access forbidden. Check your permissions.');

        case 404:

          throw new Error('Resource not found.');

        case 429:

          throw new Error('Rate limit exceeded. Please wait and try again.');

        default:

          if (error.statusCode \>= 500\) {

            throw new Error('Fathom server error. Please try again later.');

          }

          throw new Error(\`API error: ${error.message}\`);

      }

    }

    throw error;

  }

}

### Retry Logic with Exponential Backoff

async function fetchWithRetry\<T\>(

  fn: () \=\> Promise\<T\>,

  maxRetries \= 3

): Promise\<T\> {

  for (let i \= 0; i \< maxRetries; i++) {

    try {

      return await fn();

    } catch (error) {

      if (error instanceof errors.FathomError) {

        if (error.statusCode \=== 429 && i \< maxRetries \- 1\) {

          const waitTime \= Math.pow(2, i) \* 1000; // 1s, 2s, 4s

          console.log(\`Rate limited. Waiting ${waitTime}ms before retry...\`);

          await new Promise(resolve \=\> setTimeout(resolve, waitTime));

          continue;

        }

      }

      throw error;

    }

  }

  throw new Error('Max retries exceeded');

}

// Usage

const meetings \= await fetchWithRetry(() \=\>

  fathom.listMeetings({ includeTranscript: true })

);

---

## Webhooks

### Create Webhook

const webhook \= await fathom.createWebhook({

  destinationUrl: "https://your-app.com/api/webhook",

  triggeredFor: \["my\_recordings"\],

  includeTranscript: true,

  includeSummary: true,

  includeActionItems: true,

  includeCrmMatches: false

});

console.log('Webhook ID:', webhook.id);

console.log('Webhook Secret:', webhook.secret); // SAVE THIS\!

**Trigger Options:**

- `my_recordings` \- Your private recordings  
- `shared_external_recordings` \- Recordings shared by external users  
- `my_shared_with_team_recordings` \- Your recordings shared with team  
- `shared_team_recordings` \- Team recordings

### Webhook Endpoint (Next.js API Route)

// app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';

import { Fathom } from 'fathom-typescript';

export async function POST(request: NextRequest) {

  try {

    // Get raw body for signature verification

    const body \= await request.text();

    const headers \= Object.fromEntries(request.headers.entries());

    

    // Verify webhook signature

    const isValid \= Fathom.verifyWebhook(

      process.env.WEBHOOK\_SECRET\!,

      headers,

      body

    );

    

    if (\!isValid) {

      return NextResponse.json(

        { error: 'Invalid signature' },

        { status: 401 }

      );

    }

    

    // Parse payload

    const meeting \= JSON.parse(body);

    

    // Get webhook ID for idempotency

    const webhookId \= headers\['webhook-id'\];

    

    // Check if already processed

    const { data: existing } \= await supabase

      .from('processed\_webhooks')

      .select('id')

      .eq('webhook\_id', webhookId)

      .single();

    

    if (existing) {

      console.log('Webhook already processed:', webhookId);

      return NextResponse.json({ status: 'already\_processed' });

    }

    

    // Queue for async processing (or process immediately for MVP)

    await processMeetingWebhook(meeting, webhookId);

    

    // Respond quickly (within 5 seconds)

    return NextResponse.json({ status: 'received' });

    

  } catch (error) {

    console.error('Webhook error:', error);

    return NextResponse.json(

      { error: 'Internal server error' },

      { status: 500 }

    );

  }

}

### Process Webhook Payload

async function processMeetingWebhook(meeting: any, webhookId: string) {

  try {

    // Insert call details

    const { error: callError } \= await supabase

      .from('fathom\_calls')

      .insert({

        recording\_id: meeting.recording\_id,

        title: meeting.title,

        created\_at: meeting.created\_at,

        recording\_start\_time: meeting.recording\_start\_time,

        recording\_end\_time: meeting.recording\_end\_time,

        url: meeting.url,

        share\_url: meeting.share\_url

      });

    

    if (callError) throw callError;

    

    // Insert transcript segments

    if (meeting.transcript) {

      const transcriptRows \= meeting.transcript.map((segment: any) \=\> ({

        recording\_id: meeting.recording\_id,

        speaker\_name: segment.speaker.display\_name,

        speaker\_email: segment.speaker.matched\_calendar\_invitee\_email,

        text: segment.text,

        timestamp: segment.timestamp

      }));

      

      const { error: transcriptError } \= await supabase

        .from('fathom\_transcripts')

        .insert(transcriptRows);

      

      if (transcriptError) throw transcriptError;

    }

    

    // Mark webhook as processed

    await supabase

      .from('processed\_webhooks')

      .insert({ webhook\_id: webhookId, processed\_at: new Date().toISOString() });

    

    console.log(\`Successfully processed webhook for meeting: ${meeting.title}\`);

    

  } catch (error) {

    console.error('Error processing webhook:', error);

    throw error;

  }

}

### Manual Signature Verification

import crypto from 'crypto';

function verifyWebhookSignature(

  secret: string,

  headers: Record\<string, string\>,

  rawBody: string

): boolean {

  const signatureHeader \= headers\['webhook-signature'\];

  if (\!signatureHeader) return false;


  const \[version, signatureBlock\] \= signatureHeader.split(',');

  if (version \!== 'v1') return false;


  const expected \= crypto

    .createHmac('sha256', secret)

    .update(rawBody, 'utf8')

    .digest('base64');


  const signatures \= signatureBlock.split(' ');

  return signatures.includes(expected);

}

### Delete Webhook

await fathom.deleteWebhook({

  id: "webhook\_id\_here"

});

---

## Rate Limiting

### Rate Limit Details

- **Limit:** 60 requests per 60-second window  
- **Scope:** Per API key  
- **Response Code:** 429 Too Many Requests

### Rate Limit Headers

interface RateLimitHeaders {

  'ratelimit-limit': string;      // "60"

  'ratelimit-remaining': string;  // "45"

  'ratelimit-reset': string;      // "32" (seconds)

}

### Monitor Rate Limits

async function fetchWithRateLimitMonitoring() {

  try {

    const response \= await fetch('https://api.fathom.ai/external/v1/meetings', {

      headers: {

        'X-Api-Key': process.env.FATHOM\_API\_KEY\!

      }

    });

    

    // Check rate limit headers

    const remaining \= response.headers.get('ratelimit-remaining');

    const reset \= response.headers.get('ratelimit-reset');

    

    console.log(\`Rate limit: ${remaining} requests remaining\`);

    console.log(\`Resets in: ${reset} seconds\`);

    

    if (remaining && parseInt(remaining) \< 10\) {

      console.warn('⚠️ Approaching rate limit\!');

    }

    

    return await response.json();

  } catch (error) {

    console.error('Request failed:', error);

    throw error;

  }

}

### Rate Limit Handler

class RateLimitHandler {

  private requestCount \= 0;

  private windowStart \= Date.now();

  private readonly maxRequests \= 60;

  private readonly windowMs \= 60000; // 60 seconds


  async throttle() {

    const now \= Date.now();

    const elapsed \= now \- this.windowStart;

    

    // Reset window if needed

    if (elapsed \>= this.windowMs) {

      this.requestCount \= 0;

      this.windowStart \= now;

    }

    

    // Check if we're at the limit

    if (this.requestCount \>= this.maxRequests) {

      const waitTime \= this.windowMs \- elapsed;

      console.log(\`Rate limit reached. Waiting ${waitTime}ms...\`);

      await new Promise(resolve \=\> setTimeout(resolve, waitTime));

      this.requestCount \= 0;

      this.windowStart \= Date.now();

    }

    

    this.requestCount++;

  }

}

// Usage

const rateLimiter \= new RateLimitHandler();

async function fetchMeetings() {

  await rateLimiter.throttle();

  return await fathom.listMeetings({});

}

---

## Complete Code Examples

### Example 1: Fetch All Meetings and Sync to Supabase

import { Fathom } from 'fathom-typescript';

import { createClient } from '@supabase/supabase-js';

const fathom \= new Fathom({

  security: { apiKeyAuth: process.env.FATHOM\_API\_KEY\! }

});

const supabase \= createClient(

  process.env.SUPABASE\_URL\!,

  process.env.SUPABASE\_KEY\!

);

async function syncAllMeetingsToSupabase() {

  console.log('Starting sync...');


  const result \= await fathom.listMeetings({

    includeTranscript: true,

    includeSummary: true

  });


  let totalSynced \= 0;


  for await (const page of result) {

    if (page.items) {

      for (const meeting of page.items) {

        try {

          // Insert call

          const { error: callError } \= await supabase

            .from('fathom\_calls')

            .upsert({

              recording\_id: meeting.recording\_id,

              title: meeting.title,

              created\_at: meeting.created\_at,

              recording\_start\_time: meeting.recording\_start\_time,

              recording\_end\_time: meeting.recording\_end\_time,

              url: meeting.url,

              share\_url: meeting.share\_url

            }, {

              onConflict: 'recording\_id'

            });

          

          if (callError) throw callError;

          

          // Insert transcript

          if (meeting.transcript) {

            // Delete existing transcripts for this recording

            await supabase

              .from('fathom\_transcripts')

              .delete()

              .eq('recording\_id', meeting.recording\_id);

            

            // Insert new transcripts

            const transcriptRows \= meeting.transcript.map(segment \=\> ({

              recording\_id: meeting.recording\_id,

              speaker\_name: segment.speaker.display\_name,

              speaker\_email: segment.speaker.matched\_calendar\_invitee\_email,

              text: segment.text,

              timestamp: segment.timestamp

            }));

            

            const { error: transcriptError } \= await supabase

              .from('fathom\_transcripts')

              .insert(transcriptRows);

            

            if (transcriptError) throw transcriptError;

          }

          

          totalSynced++;

          console.log(\`✓ Synced: ${meeting.title} (${totalSynced})\`);

          

        } catch (error) {

          console.error(\`✗ Failed to sync ${meeting.title}:\`, error);

        }

      }

    }

  }


  console.log(\`\\n✅ Sync complete\! Total synced: ${totalSynced}\`);

}

// Run

syncAllMeetingsToSupabase();

### Example 2: Fetch Meetings with Date Filter

async function fetchRecentMeetings(days: number \= 30\) {

  const startDate \= new Date();

  startDate.setDate(startDate.getDate() \- days);


  const result \= await fathom.listMeetings({

    createdAfter: startDate.toISOString(),

    includeTranscript: true

  });


  const meetings: Meeting\[\] \= \[\];


  for await (const page of result) {

    if (page.items) {

      meetings.push(...page.items);

    }

  }


  return meetings;

}

// Usage

const last30Days \= await fetchRecentMeetings(30);

console.log(\`Found ${last30Days.length} meetings in the last 30 days\`);

### Example 3: Sync Selected Meetings

async function syncSelectedMeetings(recordingIds: number\[\]) {

  console.log(\`Syncing ${recordingIds.length} meetings...\`);


  // Fetch all meetings (or use cached list)

  const result \= await fathom.listMeetings({

    includeTranscript: true

  });


  const allMeetings: Meeting\[\] \= \[\];

  for await (const page of result) {

    if (page.items) {

      allMeetings.push(...page.items);

    }

  }


  // Filter selected meetings

  const selectedMeetings \= allMeetings.filter(m \=\>

    recordingIds.includes(m.recording\_id)

  );


  // Sync each meeting

  for (const meeting of selectedMeetings) {

    try {

      await syncMeetingToSupabase(meeting);

      console.log(\`✓ Synced: ${meeting.title}\`);

    } catch (error) {

      console.error(\`✗ Failed: ${meeting.title}\`, error);

    }

  }

}

async function syncMeetingToSupabase(meeting: Meeting) {

  // Insert call

  await supabase.from('fathom\_calls').upsert({

    recording\_id: meeting.recording\_id,

    title: meeting.title,

    created\_at: meeting.created\_at,

    url: meeting.url

  }, { onConflict: 'recording\_id' });


  // Insert transcript

  if (meeting.transcript) {

    await supabase

      .from('fathom\_transcripts')

      .delete()

      .eq('recording\_id', meeting.recording\_id);

    

    const transcriptRows \= meeting.transcript.map(segment \=\> ({

      recording\_id: meeting.recording\_id,

      speaker\_name: segment.speaker.display\_name,

      speaker\_email: segment.speaker.matched\_calendar\_invitee\_email,

      text: segment.text,

      timestamp: segment.timestamp

    }));

    

    await supabase.from('fathom\_transcripts').insert(transcriptRows);

  }

}

### Example 4: Filter Meetings by Team

async function fetchTeamMeetings(teamName: string) {

  const result \= await fathom.listMeetings({

    teams: \[teamName\],

    includeTranscript: true

  });


  const meetings: Meeting\[\] \= \[\];


  for await (const page of result) {

    if (page.items) {

      meetings.push(...page.items);

    }

  }


  return meetings;

}

// Usage

const salesMeetings \= await fetchTeamMeetings('Sales');

console.log(\`Found ${salesMeetings.length} sales meetings\`);

### Example 5: React Component for Meeting List

'use client';

import { useState, useEffect } from 'react';

import { Fathom } from 'fathom-typescript';

interface Meeting {

  recording\_id: number;

  title: string;

  created\_at: string;

  url: string;

}

export default function MeetingList() {

  const \[meetings, setMeetings\] \= useState\<Meeting\[\]\>(\[\]);

  const \[loading, setLoading\] \= useState(false);

  const \[error, setError\] \= useState\<string | null\>(null);

  const \[selectedIds, setSelectedIds\] \= useState\<number\[\]\>(\[\]);


  const fetchMeetings \= async () \=\> {

    setLoading(true);

    setError(null);

    

    try {

      const response \= await fetch('/api/fathom/meetings');

      if (\!response.ok) throw new Error('Failed to fetch meetings');

      

      const data \= await response.json();

      setMeetings(data.meetings);

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Unknown error');

    } finally {

      setLoading(false);

    }

  };


  const syncSelected \= async () \=\> {

    setLoading(true);

    

    try {

      const response \= await fetch('/api/fathom/sync', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ recordingIds: selectedIds })

      });

      

      if (\!response.ok) throw new Error('Sync failed');

      

      alert('Successfully synced selected meetings\!');

      setSelectedIds(\[\]);

    } catch (err) {

      alert('Failed to sync: ' \+ (err instanceof Error ? err.message : 'Unknown error'));

    } finally {

      setLoading(false);

    }

  };


  const toggleSelection \= (id: number) \=\> {

    setSelectedIds(prev \=\>

      prev.includes(id)

        ? prev.filter(i \=\> i \!== id)

        : \[...prev, id\]

    );

  };


  return (

    \<div className="p-6"\>

      \<div className="flex justify-between mb-4"\>

        \<h1 className="text-2xl font-bold"\>Fathom Meetings\</h1\>

        \<div className="space-x-2"\>

          \<button

            onClick={fetchMeetings}

            disabled={loading}

            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"

          \>

            {loading ? 'Loading...' : 'Fetch Meetings'}

          \</button\>

          \<button

            onClick={syncSelected}

            disabled={loading || selectedIds.length \=== 0}

            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"

          \>

            Sync Selected ({selectedIds.length})

          \</button\>

        \</div\>

      \</div\>

      

      {error && (

        \<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"\>

          {error}

        \</div\>

      )}

      

      \<div className="space-y-2"\>

        {meetings.map(meeting \=\> (

          \<div

            key={meeting.recording\_id}

            className="flex items-center p-4 border rounded hover:bg-gray-50"

          \>

            \<input

              type="checkbox"

              checked={selectedIds.includes(meeting.recording\_id)}

              onChange={() \=\> toggleSelection(meeting.recording\_id)}

              className="mr-4"

            /\>

            \<div className="flex-1"\>

              \<h3 className="font-semibold"\>{meeting.title}\</h3\>

              \<p className="text-sm text-gray-600"\>

                {new Date(meeting.created\_at).toLocaleDateString()}

              \</p\>

            \</div\>

            \<a

              href={meeting.url}

              target="\_blank"

              rel="noopener noreferrer"

              className="text-blue-500 hover:underline"

            \>

              View

            \</a\>

          \</div\>

        ))}

      \</div\>

      

      {meetings.length \=== 0 && \!loading && (

        \<p className="text-center text-gray-500 py-8"\>

          No meetings loaded. Click "Fetch Meetings" to load your calls.

        \</p\>

      )}

    \</div\>

  );

}

### Example 6: API Route for Fetching Meetings

// app/api/fathom/meetings/route.ts

import { NextRequest, NextResponse } from 'next/server';

import { Fathom } from 'fathom-typescript';

export async function GET(request: NextRequest) {

  try {

    const fathom \= new Fathom({

      security: { apiKeyAuth: process.env.FATHOM\_API\_KEY\! }

    });

    

    // Get query parameters

    const searchParams \= request.nextUrl.searchParams;

    const days \= parseInt(searchParams.get('days') || '30');

    

    const startDate \= new Date();

    startDate.setDate(startDate.getDate() \- days);

    

    const result \= await fathom.listMeetings({

      createdAfter: startDate.toISOString(),

      includeTranscript: false // Don't include transcript in list view

    });

    

    const meetings: any\[\] \= \[\];

    

    for await (const page of result) {

      if (page.items) {

        meetings.push(...page.items);

      }

    }

    

    return NextResponse.json({

      success: true,

      count: meetings.length,

      meetings

    });

    

  } catch (error) {

    console.error('Error fetching meetings:', error);

    return NextResponse.json(

      { success: false, error: 'Failed to fetch meetings' },

      { status: 500 }

    );

  }

}

### Example 7: API Route for Syncing Meetings

// app/api/fathom/sync/route.ts

import { NextRequest, NextResponse } from 'next/server';

import { Fathom } from 'fathom-typescript';

import { createClient } from '@supabase/supabase-js';

const fathom \= new Fathom({

  security: { apiKeyAuth: process.env.FATHOM\_API\_KEY\! }

});

const supabase \= createClient(

  process.env.SUPABASE\_URL\!,

  process.env.SUPABASE\_SERVICE\_KEY\! // Use service key for server-side

);

export async function POST(request: NextRequest) {

  try {

    const { recordingIds } \= await request.json();

    

    if (\!Array.isArray(recordingIds) || recordingIds.length \=== 0\) {

      return NextResponse.json(

        { error: 'Invalid recording IDs' },

        { status: 400 }

      );

    }

    

    // Fetch meetings with transcripts

    const result \= await fathom.listMeetings({

      includeTranscript: true

    });

    

    const allMeetings: any\[\] \= \[\];

    for await (const page of result) {

      if (page.items) {

        allMeetings.push(...page.items);

      }

    }

    

    // Filter selected meetings

    const selectedMeetings \= allMeetings.filter(m \=\>

      recordingIds.includes(m.recording\_id)

    );

    

    const synced: number\[\] \= \[\];

    const failed: number\[\] \= \[\];

    

    // Sync each meeting

    for (const meeting of selectedMeetings) {

      try {

        // Insert call

        const { error: callError } \= await supabase

          .from('fathom\_calls')

          .upsert({

            recording\_id: meeting.recording\_id,

            title: meeting.title,

            created\_at: meeting.created\_at,

            recording\_start\_time: meeting.recording\_start\_time,

            recording\_end\_time: meeting.recording\_end\_time,

            url: meeting.url,

            share\_url: meeting.share\_url

          }, {

            onConflict: 'recording\_id'

          });

        

        if (callError) throw callError;

        

        // Insert transcript

        if (meeting.transcript) {

          await supabase

            .from('fathom\_transcripts')

            .delete()

            .eq('recording\_id', meeting.recording\_id);

          

          const transcriptRows \= meeting.transcript.map((segment: any) \=\> ({

            recording\_id: meeting.recording\_id,

            speaker\_name: segment.speaker.display\_name,

            speaker\_email: segment.speaker.matched\_calendar\_invitee\_email,

            text: segment.text,

            timestamp: segment.timestamp

          }));

          

          const { error: transcriptError } \= await supabase

            .from('fathom\_transcripts')

            .insert(transcriptRows);

          

          if (transcriptError) throw transcriptError;

        }

        

        synced.push(meeting.recording\_id);

      } catch (error) {

        console.error(\`Failed to sync ${meeting.recording\_id}:\`, error);

        failed.push(meeting.recording\_id);

      }

    }

    

    return NextResponse.json({

      success: true,

      synced: synced.length,

      failed: failed.length,

      syncedIds: synced,

      failedIds: failed

    });

    

  } catch (error) {

    console.error('Sync error:', error);

    return NextResponse.json(

      { success: false, error: 'Sync failed' },

      { status: 500 }

    );

  }

}

---

## Supabase Schema

### SQL for Creating Tables

\-- Create fathom\_calls table

CREATE TABLE fathom\_calls (

  recording\_id BIGINT PRIMARY KEY,

  title TEXT NOT NULL,

  created\_at TIMESTAMPTZ NOT NULL,

  recording\_start\_time TIMESTAMPTZ,

  recording\_end\_time TIMESTAMPTZ,

  url TEXT,

  share\_url TEXT,

  synced\_at TIMESTAMPTZ DEFAULT NOW()

);

\-- Create fathom\_transcripts table

CREATE TABLE fathom\_transcripts (

  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  recording\_id BIGINT NOT NULL REFERENCES fathom\_calls(recording\_id) ON DELETE CASCADE,

  speaker\_name TEXT,

  speaker\_email TEXT,

  text TEXT NOT NULL,

  timestamp TEXT,

  created\_at TIMESTAMPTZ DEFAULT NOW()

);

\-- Create index for faster queries

CREATE INDEX idx\_transcripts\_recording\_id ON fathom\_transcripts(recording\_id);

CREATE INDEX idx\_calls\_created\_at ON fathom\_calls(created\_at DESC);

\-- Create processed\_webhooks table for idempotency

CREATE TABLE processed\_webhooks (

  webhook\_id TEXT PRIMARY KEY,

  processed\_at TIMESTAMPTZ DEFAULT NOW()

);

---

## Environment Variables

\# Fathom API

FATHOM\_API\_KEY=your\_fathom\_api\_key

\# Webhook

WEBHOOK\_SECRET=your\_webhook\_secret

\# Supabase

SUPABASE\_URL=https://your-project.supabase.co

SUPABASE\_KEY=your\_supabase\_anon\_key

SUPABASE\_SERVICE\_KEY=your\_supabase\_service\_key

---

## Quick Reference

### Essential SDK Methods

// List meetings

await fathom.listMeetings({ includeTranscript: true })

// Create webhook

await fathom.createWebhook({ destinationUrl, triggeredFor, includeTranscript })

// Delete webhook

await fathom.deleteWebhook({ id })

// Verify webhook

Fathom.verifyWebhook(secret, headers, body)

// List teams

await fathom.listTeams({})

// List team members

await fathom.listTeamMembers({ team: "Sales" })

### Common Filters

{

  createdAfter: "2025-01-01T00:00:00Z",

  createdBefore: "2025-12-31T23:59:59Z",

  teams: \["Sales", "Engineering"\],

  meetingType: "external",

  includeTranscript: true,

  includeSummary: true

}

### Error Status Codes

- **401** \- Invalid API key  
- **403** \- Forbidden  
- **404** \- Not found  
- **429** \- Rate limit exceeded  
- **500+** \- Server error

---

**Last Updated:** October 17, 2025  
**For:** Lovable Development Platform  
**Source:** [https://developers.fathom.ai](https://developers.fathom.ai)

