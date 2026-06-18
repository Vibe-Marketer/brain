---
spike: 006
name: calendly-recording-api-feasibility
type: standard
validates: "Given Calendly's current public API/docs, when we search for recording/transcript/media objects or webhook payloads, then we know whether CallVault can directly import Calendly calls as recordings."
verdict: INVALIDATED
related: [008-callvault-connector-implementation-fit]
tags: [calendly, connector, recording-api, source-feasibility]
---

# Spike 006: Calendly Recording API Feasibility

## What This Validates

Given Calendly's current public API/docs, when we search for recording, transcript, media, Notetaker, or recap resources and webhook payloads, then we know whether CallVault can build a native Calendly connector that pulls actual call recordings directly from Calendly.

## Research

| Source | Finding | Impact |
|---|---|---|
| Calendly API getting started | Calendly describes API v2, Embed API, and Webhook API. API v2 is REST/JSON; auth is personal access token or OAuth. | Calendly is integrable, but the documented scope is scheduling-oriented. |
| Calendly webhook overview | Webhooks are for invitee created, invitee canceled, and routing form submissions. | Webhooks can notify bookings, not finished recordings or transcripts. |
| Calendly public OpenAPI mirror | Listed paths include users, event types, availability, scheduled events, invitees, webhook subscriptions, organization memberships, routing forms, activity logs, shares, and groups. No recording/transcript/notetaker/recap API resources surfaced in the path list. | Direct API pull of recordings is not supported by the public API surface found in this spike. |
| Calendly MCP documentation | Calendly MCP exposes scheduling tools mapped to public API v2, with scheduling read/write scopes. | MCP does not unlock a hidden recording API; it appears to wrap the same scheduling capabilities. |
| Calendly Notetaker docs | Notetaker creates summaries, transcripts, and recordings, but the help surface describes UI sharing/export and CRM/Zapier pushes, not a public API for recap media. | Data exists inside Calendly, but developer access appears limited to integrations/exports rather than first-party API pull. |

Sources checked:

- https://developer.calendly.com/getting-started
- https://calendly.com/help/webhooks-overview
- https://raw.githubusercontent.com/api-evangelist/calendly/refs/heads/main/openapi/calendly-scheduling-api-openapi.yml
- https://developer.calendly.com/calendly-mcp-server
- https://calendly.com/help/notetaker-overview
- https://calendly.com/help/how-to-manage-and-share-notetaker-recaps
- https://calendly.com/help/how-to-send-recaps-to-your-crm-and-other-apps

## How to Run

```bash
node .planning/spikes/006-calendly-recording-api-feasibility/calendly-api-surface-probe.mjs
```

## What to Expect

The script prints the public OpenAPI paths, any recording-related path matches, and body keyword matches. On 2026-06-18, the path set was scheduling/admin oriented and did not expose recording, transcript, Notetaker, recap, audio, or video endpoints. A generic `recording` body keyword appeared only in the sense of an activity log "recording an action," not as a media resource.

## Investigation Trail

1. Checked official developer overview: API v2, Embed API, and Webhook API are available; docs position Calendly as scheduling data and automation.
2. Checked official webhook article: webhook events cover scheduling/cancellation/routing form submissions.
3. Checked official MCP docs: hosted Calendly MCP maps to scheduling capabilities and public API scopes.
4. Pulled a machine-readable OpenAPI mirror from the API Evangelist Calendly repo and searched for recording/media terms and path resources.
5. Checked Notetaker help: recordings/transcripts exist in the product, but export/share paths are user-facing or CRM/Zapier integrations.

## Results

Verdict: INVALIDATED for "native Calendly recording API connector."

Calendly can tell us that a meeting was scheduled and provide metadata such as event type, time, invitees, location, and routing-form context. The public API evidence did not show a way to list or fetch Notetaker recordings, Notetaker transcripts, recap videos, or recap metadata directly. A connector labeled "Calendly" that promises to pull call recordings from Calendly would be misleading unless Calendly grants a private/partner API or adds public Notetaker endpoints.

Confidence: medium-high. This used current public docs and a public OpenAPI mirror, but not an authenticated Calendly Notetaker account or Calendly partner support confirmation.
