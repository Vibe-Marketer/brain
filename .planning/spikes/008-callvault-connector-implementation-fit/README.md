---
spike: 008
name: callvault-connector-implementation-fit
type: standard
validates: "Given CallVault's existing connector architecture, when the viable data path is known, then we can classify implementation as native OAuth connector, calendar-triggered recorder routing, or unsupported/partner-only."
verdict: PARTIAL
related: [006-calendly-recording-api-feasibility, 007-calendly-recorder-product-reality]
tags: [calendly, callvault, connector-architecture, implementation-fit]
---

# Spike 008: CallVault Connector Implementation Fit

## What This Validates

Given the Calendly feasibility results and CallVault's connector architecture, when we map likely data paths into the product, then we know what to build, what not to promise, and what questions must be answered with the client.

## Build Order Constraint

Do not start Calendly-specific implementation first. The next work should be a separate **Automation Intake / Universal Push Import** spike line covering Zapier, Make, n8n, and a generic inbound webhook contract. Calendly Notetaker should sit on top of that validated intake path; otherwise a Calendly-only receiver risks becoming a one-off workaround instead of a durable import surface.

## Research

| CallVault surface | Current pattern | Calendly fit |
|---|---|---|
| `src/config/source-registry.ts` | Single source of truth for source metadata, auth mode, webhook/sync/search functions, and visibility. | A Calendly entry is easy mechanically, but should not be user-visible as a recording connector unless the data path is real. |
| `src/components/connectors/registry/connectorRegistry.ts` | New sources add one adapter and register it. Acceptance target notes native provider connector is <= 2 days once credentials/API access exist. | UI plumbing is not the hard part. Data availability is. |
| `src/components/connectors/registry/adapters/adapter-helpers.ts` | Shared helpers already cover OAuth URL, token credential save, date-range search, selected import, and disconnect. | Calendly scheduling metadata can reuse OAuth/search patterns; Notetaker media cannot unless an API/push payload exists. |
| `supabase/functions/_shared/connector-pipeline.ts` | `ConnectorRecord` needs `external_id`, `source_app`, `title`, `full_transcript`, start/end/duration, optional transcript segments, metadata, summary, org/workspace routing. | Calendly scheduled events do not naturally satisfy `full_transcript`; Notetaker/Zapier/manual export could. |
| Existing Zoom connector | Zoom cloud recordings already sync through a native source. | If client uses Calendly + Zoom cloud recordings, prefer Zoom as the recording connector and optionally add Calendly metadata later. |

Local code/context checked:

- `src/config/source-registry.ts`
- `src/components/connectors/registry/connectorRegistry.ts`
- `src/components/connectors/registry/adapters/adapter-helpers.ts`
- `supabase/functions/_shared/connector-pipeline.ts`
- `.planning/codebase/INTEGRATIONS.md`
- CodeGraph context for connector registry and connector pipeline

## How to Run

No local command. This is an architecture-fit spike grounded in source reads and CodeGraph.

## What to Expect

Implementation classification:

| Option | Build shape | Verdict |
|---|---|---|
| Native `calendly` recording connector | Add Calendly OAuth, scheduled-event sync/search, then attempt Notetaker recording/transcript fetch. | Do not build yet; no public recording fetch endpoint found. |
| Calendly scheduling metadata connector | OAuth + webhooks/sync scheduled events, store scheduling metadata, link to recordings imported from another source by time/invitees/location URL. | Feasible, but it is not a recording connector by itself. |
| Notetaker push/import receiver | Create a CallVault intake endpoint/Zapier target/manual paste path that accepts recap summary, transcript, recording link, and meeting metadata. | Best near-term "Calendly Notetaker" path if Zapier exposes enough fields. |
| Underlying recorder source | Use existing Zoom connector, future Google Meet/Teams connectors, or manual import; enrich with Calendly event context later. | Best near-term path for real recordings. |
| Partner/private API path | Ask Calendly for Notetaker API/partner access. | Only path that would justify a polished native Calendly recording connector. |

## Investigation Trail

1. Re-read CallVault source-registry and connector registry constraints.
2. Used CodeGraph to locate connector pipeline expectations.
3. Compared Calendly scheduled-event data to `ConnectorRecord`.
4. Identified the gap: CallVault's pipeline requires transcript/media content; Calendly public API provides scheduling metadata.
5. Ranked implementation paths by honesty and feasibility.

## Results

Verdict: PARTIAL.

CallVault can support a Calendly-labeled surface, but only if the label matches the actual capability:

1. Do not ship "Connect Calendly recordings" as a native OAuth source based on current public API evidence.
2. Spike Automation Intake / Universal Push Import before Calendly Notetaker work.
3. If the client uses Zoom through Calendly, connect Zoom first; that is the fastest real recording path.
4. If the client has Calendly Notetaker, validate whether Zapier's "Recap created" trigger includes transcript text and recording links through the broader automation-intake spike. If yes, build the generic CallVault intake receiver first, then layer Calendly Notetaker import on top.
5. If Calendly offers private/partner Notetaker API access, then a native `calendly` source can follow the existing native connector pattern.

Recommended next client questions:

1. Are these calls recorded by Calendly Notetaker, Zoom cloud recording, Google Meet, Teams, or another recorder?
2. Can the client open Calendly Recaps and download TXT transcripts/video today?
3. Does their Calendly account show Zapier's `Recap created` trigger, and what fields are included?
4. Are recording links shareable/downloadable without an authenticated browser session?
5. Is the client willing to grant Zoom/Google/Microsoft access if Calendly is only the scheduler?
