# Phase 38: Access Policy, Share-Link Key Migration, Request Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 38-access-policy-share-link-key-migration-request-flow
**Areas discussed:** Recording access, Participant discovery, Request and approval flow, Settings presentation

---

## Recording access

| Question | Options considered | Selected |
|---|---|---|
| Default for newly imported recordings | Private; Verified attendees; Organization members | Private |
| How owners choose who can read | One clear level; Mix multiple groups; Simple level plus exceptions | One clear level |
| Default setting or per-recording option | Account default plus per-recording override | Both |
| Effect of changing the account default | Future recordings only; Ask each time; Update everything | Future recordings only |
| Who can change access | Recording owner; Owner and org admins; Owner within admin limits | Recording owner only |

**User's choice:** New recordings default to Private. Settings supplies an account default, and each recording may override it. The six levels are Private, Attendees, Invitees, Organization, Anyone with link, and Public. Changes to the default affect only future recordings. Only the recording owner can change a recording's policy.

**Notes:** Existing explicit team access and share links must continue working.

---

## Participant discovery

| Question | Options considered | Selected |
|---|---|---|
| What a participant sees | Anonymous recording rows; Count only; Count and provider | Anonymous numbered rows |
| Who can discover copies | Confirmed participants; Participants and invitees; Organization members | Confirmed participants only |
| Large meetings and webinars | Hide discovery; Show count; Use normal rows | Hide discovery |
| Large-event threshold | Webinar signal or 50+; Webinar signal only; 100+ | Webinar signal or 50+ |

**User's choice:** Show anonymous numbered copies with Request access only to confirmed participants backed by verified evidence. Hide discovery for webinars and events with at least 50 confirmed participants.

**Notes:** Never reveal owner, provider, title, transcript, or summary. Large-event access requires a direct invitation or share link.

---

## Request and approval flow

| Question | Options considered | Selected |
|---|---|---|
| Owner notification | In-app and email; In-app only; Email only | In-app and email |
| Review information | Identity and meeting context; Add personal message; Identity only | Identity and meeting context |
| Approval duration | Until revoked; 30 days; Owner-selected duration | Until revoked |
| After denial | Notify and wait 30 days; Final denial; Immediate retry | Notify and wait 30 days |

**User's choice:** Give the owner a persistent in-app notification and an email with a direct review link. Show verified identity and meeting evidence, with no free-form requester message. An approval lasts until revoked. A denial triggers a neutral notification and a 30-day retry wait.

**Notes:** Log approvals, denials, and revocations. Do not expose a private denial reason.

---

## Settings presentation

| Question | Options considered | Selected |
|---|---|---|
| Account default location | Privacy & Access; General; Import settings | Settings > Privacy & Access |
| Per-recording location | Beside Share; Existing Share dialog; Overflow menu | Access button beside Share |
| Copy-specific explanation | Always visible; Tooltip; Broad-access warning only | Always visible |
| Inherited-value presentation | Using default with Reset; Silent; Permanent copy | Using default with Reset |

**User's choice:** Put the account default in Settings > Privacy & Access. Put an Access button beside Share that opens one compact management panel. Always explain that this controls only the owner's copy. Label overrides Custom and offer Reset to default.

**Notes:** Require confirmation before Public. The exact explanation is: “This controls your recording only. Other attendees control their own copies.”

## the agent's Discretion

- Additive schema and compatibility design.
- Internal naming and exact component composition.
- Notification and email copy within the selected behavior and brand constraints.
- Safe UUID migration or bridge mechanics for `call_share_links`.

## Deferred Ideas

None.
