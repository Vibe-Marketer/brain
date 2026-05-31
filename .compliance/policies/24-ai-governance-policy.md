---
policy_id: AIG-024
title: AI Governance Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-31
next_review_due: 2027-05-31
parent_policy: ISP-001
trust_services_criteria: ["CC1.4", "CC2.3", "CC6.5", "C1.1", "P3.2"]
external_frameworks_referenced: ["NIST AI RMF 1.0", "EU AI Act (Regulation (EU) 2024/1689)", "ISO/IEC 42001:2023"]
---

# AI Governance Policy

## 1. Purpose

Defines how CallVault selects, configures, monitors, and discloses AI systems that process customer data — including LLM-backed MCP tools, embedding pipelines, and any future ML/AI feature.

## 2. Scope

All AI systems integrated into CallVault, including:

- **AI-tier MCP tools** — `ask_call`, `extract_action_items`, `get_sentiment`, `get_coaching_notes`
- **Embedding pipelines** — transcript chunking, vector generation, retrieval-augmented chat
- **Future AI features** — any ML or LLM-backed functionality added to the product
- **AI development assistants** used internally — Claude Code, GitHub Copilot, Cursor (governed by the Acceptable Use Policy §5)

## 3. AI Provider Selection Criteria

CallVault evaluates AI providers against these criteria before integration:

1. **No-training guarantee on customer data.** Provider must contractually commit (via DPA, API terms, or BAA) that customer data submitted via API is not used to train models. Providers that train on API data are categorically rejected.
2. **Data residency disclosure.** Provider must disclose where inference happens.
3. **Subprocessor transparency.** Provider must publish its own subprocessor list.
4. **Security posture.** Provider should hold SOC 2 Type II or equivalent (per Vendor & Subprocessor Management Policy §4).
5. **Independent audit availability.** Provider should make audit reports available under NDA.
6. **Acceptable use alignment.** Provider's acceptable-use policy must permit CallVault's use case (business call intelligence).

## 4. Current AI Provider Inventory

| Provider | Use | No-training guarantee | DPA | Compliance posture |
|----------|-----|------------------------|-----|---------------------|
| **Anthropic** (via OpenRouter) | LLM inference for AI-tier MCP tools | ✅ Anthropic API does not train on customer data per their Privacy Policy / Commercial Terms | Via OpenRouter pass-through | SOC 2 Type II, HIPAA BAA available, ISO 27001 |
| **OpenAI** (via OpenRouter) | LLM inference for AI-tier MCP tools | ✅ OpenAI API does not train on customer data (opt-out is the default for API customers per OpenAI policy) | Via OpenRouter pass-through | SOC 2 Type II, CSA STAR Level 1, HIPAA BAA available |
| **OpenRouter** | Routing layer; selects provider per request | ✅ OpenRouter itself does not train on routed content; routes to providers with their own no-training guarantees | Pending direct DPA execution (RISK queued) | Per OpenRouter's published policy |

This inventory is reproduced on the public trust page at `callvaultai.com/trust` and in the DPA at `callvaultai.com/dpa` §4.2.

## 5. Data Flow Boundaries

### 5.1 When customer data leaves CallVault

Customer transcript text is transmitted to an external LLM provider **only** when:

- A customer (via authenticated session or MCP token) explicitly invokes an AI-tier MCP tool
- The customer has not configured a workspace-level opt-out (when that feature exists; see Section 7)

The transmission is over TLS to a named subprocessor. The transcript content is included only insofar as required for the requested inference; no broader payload is sent.

### 5.2 What customer data does NOT leave

CallVault does not transmit to external LLMs:

- Authentication credentials, MCP tokens, OAuth grants
- Customer billing / payment data
- Customer organization metadata, workspace structure, or membership lists
- Per-tool-call audit log entries (kept internal in `ai_usage` table)
- Customer contact records (unless the customer invokes a tool that requires them, in which case only the specific record being processed)

## 6. AI Output Quality and Correction

CallVault treats AI tool outputs as **suggestions**, not authoritative determinations.

- **Outputs are user-facing.** Customers see the AI-generated content and can disregard it.
- **No automated action** is taken based on AI output without customer confirmation. AI does not delete data, modify records, send communications, or change permissions on its own.
- **Customer can flag errors.** Customers may report incorrect or harmful AI outputs to `support@callvaultai.com`. Reports are reviewed by the Information Security Officer.
- **Material patterns of error trigger a model review.** If a pattern of incorrect outputs emerges, CallVault may switch providers, change model selection, or adjust prompts. Material changes are disclosed via release notes.

## 7. Customer Control

| Control | Status | Mechanism |
|---------|--------|-----------|
| Customer can choose not to invoke AI tools | ✅ Always available | Don't call the AI-tier MCP tools; the rest of the service operates without LLM transit |
| Customer can disable AI tools per token | ✅ Available | At `/settings/mcp` per-token category gating allows excluding the AI category |
| Customer can disable AI tools per workspace | ⏳ Roadmap | Future per-workspace AI feature flag |
| Customer can choose AI provider | ⏳ Roadmap | Future workspace setting to prefer Anthropic vs OpenAI vs disable AI tools entirely |
| Customer can request all AI outputs deleted | ✅ Available | Per the Data Retention & Deletion Policy — AI outputs are stored alongside source data and deleted on the same cascade |

## 8. AI Incident Response

AI-specific incidents (e.g., LLM provider data breach, model returning hallucinated PII, prompt injection successfully exfiltrating data) are handled per the Incident Response Plan with these AI-specific considerations:

- Customer notification includes the AI provider involved
- LLM provider is notified per the DPA / API terms
- If the incident affects a specific model or prompt path, the path may be disabled until remediated
- Post-mortem includes whether the AI provider's published incident response timeline was met

## 9. Regulatory Alignment

### 9.1 NIST AI RMF 1.0

CallVault aligns to the Risk Management Framework's four core functions:

- **GOVERN** — this Policy + Risk Register entries (incl. RISK-004 LLM transit) constitute the governance function for the single-principal stage
- **MAP** — Section 5 (data flow boundaries) + provider inventory in Section 4 satisfy mapping
- **MEASURE** — `ai_usage` table tracks every invocation; customer feedback to support@callvaultai.com is the qualitative measurement channel
- **MANAGE** — provider rotation + tool deprecation + customer-control mechanisms in Section 7

### 9.2 EU AI Act tier classification

CallVault's AI features are classified as **Limited Risk** under the EU AI Act:
- The AI tools generate text outputs that customers can read and disregard
- No biometric categorization, no social scoring, no critical-infrastructure decisions, no recruitment scoring, no law-enforcement use
- No use cases listed under Annex III (High-Risk)

CallVault meets the **transparency obligation** for Limited Risk by disclosing AI-generated content as such in the UI and via this Policy.

### 9.3 ISO/IEC 42001:2023 (AI Management Systems)

CallVault does not currently pursue ISO 42001 certification. The policy structure is consistent with the standard's framework should certification be pursued later.

### 9.4 CCPA / CPRA — Automated Decision-Making Technology (ADMT)

CallVault's AI tools do not make "significant decisions" within the meaning of California's emerging ADMT rules — outputs are advisory text consumed by humans. CallVault is not in scope for ADMT disclosure obligations as currently drafted.

## 10. Internal AI Tool Use

Workforce use of AI development assistants (Claude Code, Cursor, GitHub Copilot, ChatGPT) is governed by the Acceptable Use Policy §5. Summary:

- AI coding assistants may be used for non-customer-data tasks (writing code, debugging local dev environments, drafting policies)
- Customer transcripts must not be pasted into personal AI sessions outside the documented subprocessor chain
- AI-suggested code is reviewed before merging like any other code change (per Change Management Policy)

## 11. Review

This Policy is reviewed:

- Annually (next: 2027-05-31)
- On any change to the AI subprocessor inventory
- On material change to applicable AI regulation (EU AI Act delegated acts, state ADMT rules, NIST AI RMF updates)
- After any AI-specific security incident

## 12. Related documents

- ISP-001 (Information Security Policy) — parent
- VMP-006 (Vendor & Subprocessor Management Policy) — provider selection process
- DRP-004 (Data Retention & Deletion Policy) — AI output retention
- ACP-002 (Access Control Policy) — MCP token category gating
- IRP-005 (Incident Response Plan) — incident handling
- Risk Register — RISK-004 (LLM subprocessor transit)
- DPA — published at callvaultai.com/dpa
- Trust page — published at callvaultai.com/trust
