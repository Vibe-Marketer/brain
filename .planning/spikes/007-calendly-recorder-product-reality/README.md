---
spike: 007
name: calendly-recorder-product-reality
type: standard
validates: "Given Calendly's current product surface, when we identify what Calendly recorder actually means in client usage, then we know whether this is native Calendly data or really Zoom/Google Meet/Teams/third-party recorder data scheduled by Calendly."
verdict: PARTIAL
related: [006-calendly-recording-api-feasibility, 008-callvault-connector-implementation-fit]
tags: [calendly, notetaker, product-reality, connector]
---

# Spike 007: Calendly Recorder Product Reality

## What This Validates

Given a client says they are using a "Calendly recorder," when we inspect Calendly's current product surface, then we can distinguish between actual Calendly Notetaker data and underlying meeting-platform recordings that were merely scheduled through Calendly.

## Research

| Observation | Evidence | Connector implication |
|---|---|---|
| Calendly Notetaker is a real product, but limited availability. | Help docs say it is gradually rolling out to eligible users. | A client may genuinely have Calendly-hosted recap data, but access is not universal. |
| Notetaker records Zoom, Google Meet, and Microsoft Teams calls. | Calendly docs say Notetaker works with those platforms and can work even when the meeting was not scheduled through Calendly. | "Calendly call" is often a scheduling wrapper around Zoom/Meet/Teams, not a distinct media platform. |
| Notetaker generates summaries, transcripts, action items, recap pages, video links, and downloadable TXT/video from the UI. | Help docs describe opening recaps, downloading transcript TXT, and downloading recap video. | Manual import is possible, and browser/automation may be possible, but first-party API pull is unproven. |
| Notetaker can push recap data to Salesforce, HubSpot, and Zapier-connected apps. | Calendly help says recap-created Zapier triggers can send summary/recording link details to other apps. | The practical integration path may be Zapier/webhook-style push into CallVault, not a Calendly OAuth pull. |
| Recording consent is meeting-platform mediated. | Docs say Notetaker joins as a participant and the host must approve recording in some flows. | There will be missing recaps for denied consent, short meetings, no audio, or host refusal. |

Sources checked:

- https://calendly.com/help/notetaker-overview
- https://calendly.com/help/how-to-manage-and-share-notetaker-recaps
- https://calendly.com/help/how-to-send-recaps-to-your-crm-and-other-apps
- https://calendly.com/help/ai-at-calendly
- https://calendly.com/help/troubleshooting-notetaker

## How to Run

No local command. This is a product-surface spike using current public Calendly docs.

## What to Expect

If a client says "Calendly recorder," ask which of these is true:

1. They have Calendly Notetaker recaps in Calendly.
2. Calendly schedules Zoom meetings and Zoom cloud recording is enabled.
3. Calendly schedules Google Meet/Teams and recordings live in Google Drive/Microsoft.
4. They use a third-party recorder that joins Calendly-scheduled calls.
5. They only have Calendly meeting metadata, not recordings.

## Investigation Trail

1. Started with the assumption that "Calendly recorder" might mean a native recorder API.
2. Found Notetaker: real product, limited rollout, with recordings/transcripts/recaps.
3. Found no public Notetaker API in developer docs.
4. Found official push-style integrations to Salesforce/HubSpot/Zapier.
5. Reframed "Calendly calls" as an ambiguous source: scheduling origin, Notetaker-hosted recap, or underlying video platform recording.

## Results

Verdict: PARTIAL.

There is enough product reality to justify a Calendly-labeled import path, but not enough to justify a native "connect Calendly and sync recordings" promise. The most honest product language is closer to:

- "Calendly-scheduled calls" if we enrich recordings from Zoom/Meet/Teams with Calendly metadata.
- "Calendly Notetaker recap import" if the client can push/export recap data.
- "Calendly" only after verified partner/private API access or a Zapier/Notetaker push receiver exists.

Likelihood of success by path:

| Path | Likelihood | Notes |
|---|---:|---|
| Native Calendly OAuth pull of Notetaker recordings/transcripts | Low | No public endpoint found. |
| Calendly scheduling metadata connector | High | Public API and webhooks support this. |
| Zapier/CRM push from Notetaker recap into CallVault | Medium | Officially described, but depends on available fields and client Zapier access. |
| Underlying Zoom/Meet/Teams recorder connector with Calendly metadata | Medium-high | Zoom is already native in CallVault; Google Meet/Teams would require separate source work unless data arrives through Notetaker/Zapier/manual import. |
