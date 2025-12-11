---
description: Implementation Plan for Premium Webhook Intelligence Center
---

# Plan: Premium Webhook Intelligence Center

**Objective:** Transform the "Webhook Debugger" from a simple log viewer into a high-value "Intelligence Center" that validates the entire pipeline—from receipt to data storage and AI processing.

## 1. Design & Layout Overhaul ("The Neon Vision")
We will implement the exact "Split-Pane" layout from your reference image, ensuring 100% scrolling fidelity (no body scroll, only panel scroll).

*   **Global Container:** Fixed height (within parent), `overflow-hidden`, deep dark background (`#0B0F1A`).
*   **Sidebar (Left, 320px):**
    *   **Style:** "Floating Cards" list. Each item is a distinct card with a subtle border and glow on hover.
    *   **Data:** Status Dot (pulsing), Title, Relative Time, and ID.
*   **Main Stage (Right, Flex-1):**
    *   **Header:** Large, bold status indicators with "Glass" badges.
    *   **Background:** subtle ambient radial gradients (Indigo/Green) to give depth.

## 2. Functional Value Extensions ("Beyond Error Checking")
The current version only checks "Is the signature valid?". We will add **"Did it work?"** checks.

*   **Database Verification:**
    *   *Action:* auto-query `fathom_calls` table using the `meeting_id` from the webhook payload.
    *   *Value:* Confirms the webhook actually wrote data to the DB.
    *   *UI:* A "Data Storage" card showing "Record Created" vs "Missing".
*   **AI Processing Status:**
    *   *Action:* Check the `status` column of the meeting.
    *   *Value:* Tells the user if the AI analysis is "Pending", "Processing", or "Complete".
    *   *UI:* Uses a "Brain" icon status card.
*   **Actionability:**
    *   **"Replay Event" Button:** A prominent button to re-trigger the processing logic (initially a toast simulation, but architected to call an Edge Function later).

## 3. Visualization Upgrade ("The Logic Flow")
We will replace the simple boxes with a **True Visualization** of the verification logic.

*   **Visual Style:** Horizontal Flowchart.
    *   **Nodes:** `Resolution` -> `Secret Found` -> `Verification Method`.
    *   **Connectors:** Real SVG lines drawing paths between nodes.
    *   **Animation:** Subtle pulse on the "Active" path (e.g., if it passed via Svix, that path glows).

## 4. Implementation Steps

1.  **Refactor Layout Structure:** Ensure strictly isolated scrolling contexts (Sidebar vs Main) to fix the "can't scroll down" issue permanently.
2.  **Enhance Data Fetching:** Update the component to fetch the related `fathom_calls` record for the selected webhook.
3.  **Build "Outcome Cards":** Create the new UI section for "Data Storage" and "AI Status" diagnostics.
4.  **Implement SVG Logic Graph:** Build the horizontal node tree with SVG connectors.
5.  **Apply "Neon" Polish:** Apply the specific `shadow-[0_0_15px_...]` utilities and `backdrop-blur` classes to match the reference image's premium feel.

**Verification:**
After this implementation, clicking a webhook will tell you:
1.  Is it valid? (Signature)
2.  Is it saved? (Database)
3.  Is it processed? (AI)
