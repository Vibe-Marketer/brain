# Phase 39: Discovery and Claim - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 39-discovery-and-claim
**Areas discussed:** Discovered events experience, participation invitations, secure email claim, claim scope and ongoing discovery

---

## Discovered Events Experience

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Post-verification result | Persistent count + View events; automatic navigation; count only | Persistent count + View events |
| Destination | Filtered Calls view; dedicated Events page; Settings results panel | Dedicated Events page |
| Presentation | Event cards; compact table; timeline | Event cards |
| Ordering | Needs action first; newest first; two fixed sections | Needs action first, then available; newest within groups |

**User's choice:** A persistent discovery result leads to a dedicated card-based Events page, ordered by actionability.
**Notes:** Private recording titles, owners, providers, and content remain hidden unless already readable through an existing access path.

---

## Participation Invitations

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Who can invite | Recording owner; owner and org admins; any viewer | Recording owner only |
| Action location | Beside eligible participants; Events page; both | Beside eligible participants |
| Sending behavior | One at a time; multi-select; invite everyone | One participant at a time |
| Reminder behavior | Manual resend; automatic reminder; no resend | Status + manual resend, with optional one-time automatic reminder |
| Reminder configuration | Optional per invitation; always automatic; account-wide default | Optional per invitation |

**User's choice:** Owner-controlled, participant-row invitations sent individually, with visible status and a restrained reminder option.
**Notes:** Manual resend unlocks after 7 days. The owner may opt an invitation into one automatic reminder; it is off by default.

---

## Secure Email Claim

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Ownership proof | Single-use link; link plus code; code only | Single-use link |
| Expiration | 7 days; 24 hours; 30 days | 7 days |
| Different signed-in email | Add invited email; switch accounts; let user choose | Add and verify invited email on current account |
| Signed-out/new recipient | Preserve through login/signup; signup then return manually; unauthenticated preview | Preserve and complete automatically after authentication |

**User's choice:** A seven-day, single-use link carries the claim through authentication with no second code.
**Notes:** A user signed into another account can attach and verify the invited email rather than creating a duplicate account.

---

## Claim Scope and Ongoing Discovery

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Claim breadth | Every current/future match; invited event only; current matches only | Every current and future match |
| Future matches | Add and notify; add silently; require confirmation | Add automatically and notify |
| Notification channel | In-app only; in-app and email; daily email digest | In-app only |
| Disconnect behavior | Remove from Settings; pause future discovery; support-only | Self-service disconnect from Settings |

**User's choice:** Verify an email once, connect all matching participation now and later, notify in-app, and allow self-service disconnect.
**Notes:** Disconnecting removes visibility derived only from that email and stops future matches without deleting original participant records. A claim never grants recording content.

---

## the agent's Discretion

- Exact route and visual composition for the dedicated Events page.
- Empty, loading, pagination, and safe generic error states.
- Additive schema, RLS, token, reminder scheduling, service, hook, and email implementation details.
- Safe generic handling for expired, replayed, revoked, or mismatched claim links.

## Deferred Ideas

- Bulk or invite-everyone participant actions.
- Repeating automatic reminders or account-wide reminder defaults.
- Ongoing email notifications or daily digests for future matches.
- Private event previews before authentication.
