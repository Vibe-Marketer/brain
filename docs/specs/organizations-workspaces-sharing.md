# HOW THE ORGANIZATIONS, WORKSPACES, AND SHARING WORKS WITHIN CALLVAULT

## 1. Tenant boundary

**Organization**

- Hard boundary.  
- Nothing is *ever* “moved” between orgs.  
- To get a call into another org: **copy** it (genrate a new internal `call_id`) and *optionally* delete the original.  (more on this later)
- What happens in Org A is never visible in Org B. What happens in Org B never visible in org A. 

Think: org = company / client / personal / business account.

---

## 2. Workspaces inside an org

Purpose: **share subsets of calls with specific people.**

- A workspace is a named collection + member list.
- You add members to a workspace; they see only calls that are in that workspace (plus whatever their org role or personal imports gives them).
- Workspaces are **not** based on source (Zoom, Fathom, whatever). Source is just metadata, the only thing source affects is how a call is displayed in the CallDialogue. 

Inside each org you have:

1. **HOME workspace (system)**  
   - Contains **all calls in the org**, always... NO MATTER WHAT (BUT also ensure that there's NEVER any leakage of customer data from one customer to another OR from one organization to another. THIS MUST ALWAYS BE KEPT IN MIND) Source doesn't matter, import doesn't matter, all imports and sources always appear in this table/workspace. If a call exists in the 
   - It’s basically a built-in view, not a manual collection.  
   - You don’t “remove” a call from HOME unless you delete the call from the org entirely.

2. **Custom workspaces (user-created)**  
   - “AE Team,” “Client – Acme,” “Training Library,” etc.  
   - You manually add/remove calls to/from these.

---

## 3. Call <-> workspace relationship

Calls are **owned at the org level**, and can live in **one or many workspaces** inside that org.

**Data model:**

- `calls`  
  - `id`  
  - `org_id`  
  - `created_by_user_id`  
  - `source` (Zoom, folder, etc.)  
  - other metadata (title, timestamps, etc.)

- `workspaces`  
  - `id`  
  - `org_id`  
  - `name`  
  - `is_home` (boolean; exactly one per org is true)

- `call_workspace_links`  
  - `call_id`  
  - `workspace_id`  
  - `added_by_user_id`  
  - `created_at`

**Rules:**

- Every call is in **exactly one org**.
- HOME workspace shows `ALL calls where org_id = X` (you don’t need links for HOME, you can fake it in the query).
- For non-HOME workspaces:
  - “Add call to workspace” = insert row in `call_workspace_links`.
  - “Remove call from workspace” = delete that row.
- A call can be in 0, 1, or many non-HOME workspaces.
- Deleting a call:
  - Removes it from HOME (because it’s gone) and all links.

Access:

- Org Owner/Admin: see all calls in all workspaces in that org.
- Regular members: see only calls in workspaces they’re a member of (plus whatever “My calls” view you define).

---

## 4. Cross-org behavior

- To “share” a call to another org:
  - Export/copy to Org B → create a **new call** in Org B with new `id`.
  - Optionally keep a `source_call_id` linking back to the original.
- If the user wants to “move” it:
  - Copy to Org B.  
  - Then delete from Org A.  
  - No magic shared state between orgs.

---

## 5. Personal folders & tags

These stay what you said: **personal organization only.**

- `personal_folders` / `personal_folder_calls`
- `personal_tags` / `personal_call_tags`
- Scoped to `user_id` (and probably `org_id` or `workspace_id`).
- NO impact on permissions. NO impact on org/workspace membership. Just views.

---
“Implement exactly this. If you think it should be different, write up the change and why, and get my signoff before coding.”

This matches what you described:  
- Org = hard wall.  
- HOME = everything.  
- Workspaces = shareable subsets.  
- Calls = can live in multiple workspaces, but only one org.

---

# SOME FAQs AND AREAS THAT MAY CAUSE CONFUSION OR GOTCHAS: 

### 1. HOME vs Workspaces vs Organizations

**Organizations**

- Hard tenant boundary.  
- Calls NEVER “move” between orgs.  
- To get a call into another org: **copy** it (new `call_id`), then optionally delete it from the original org.  
- What happens in Org A is invisible to Org B. Always.

**HOME workspace**

- Think of HOME as: **“All calls in this org.”**  
- Every call in an org is always in HOME.  
- The only way a call stops appearing in HOME is if it’s deleted from that org entirely (“delete everywhere”).

So:

> “If a customer wants to move a call out of HOME into a different workspace, is that possible?”  
> **No.** You cannot move a call *out* of HOME.  
> You can only:
> - Add/remove it from **other workspaces** in the same org, and/or  
> - Copy it into a **different organization** and then delete it from the original org.

**Other workspaces (inside an org)**

- These are **sharing / segmentation** layers.  
- A call can be in 0, 1, or many of these workspaces, but it is always in HOME for that org.
- “Move to workspace X” in the UI =  
  - Add call to workspace X (create link),  
  - Optionally remove it from workspace Y (delete link),  
  - Call still exists in HOME and in the org.

### 2. Deletion semantics

Inside an org:

- **Delete from workspace**  
  - Only removes the call from that workspace (delete the link).  
  - Call still exists in HOME and any other workspaces it’s in.

- **Delete from everywhere / from org**  
  - Removes the call from HOME + all workspaces + all personal folders/tags + indexes.  
  - This is the only way to make it disappear from HOME.

Cross-org:

- “Move” = copy to target org, then delete from source org. No shared state.

### 3. FAQs / Gotchas to include for the dev

You can literally paste this section into the spec:

- **Q:** Can a call belong to multiple workspaces in the same org?  
  **A:** Yes. Implement a `call_workspace_links` (or equivalent) table with a unique constraint on `(call_id, workspace_id)`.

- **Q:** Can a call belong to multiple organizations?  
  **A:** No. One org only. Copies across orgs are new calls with new IDs.

- **Q:** Does removing a call from a workspace delete it?  
  **A:** No. It only deletes the association. Global delete is a separate action.

- **Q:** What happens when a workspace is deleted?  
  **A:** All its call links are removed. Calls remain in HOME and any other workspaces.

- **Q:** How is AI access scoped?  
  **A:** A workspace-only user should only be able to query calls in workspaces they have access to. HOME visibility is role-based (e.g. org admins see everything).

- **Q:** What about personal folders/tags?  
  **A:** They are user-specific views only. No impact on org/workspace membership or permissions. Deleting a call removes its folder/tag links automatically.

- **Q:** What about naming?  
  **A:** **All table/entity names in this spec are conceptual.** Before coding, map them to our actual schema and naming conventions. Do not assume the example names exist 1:1.

And one principle to remind them of:

> We keep the core entities minimal and evolve as we get real usage. We don’t start with a “finished” model; we start simple and let reality tell us what to add. [$100M Money Models, Page 150],[$100M Money Models, Page 155]

You’re not lost. You’re just doing the unsexy “get it right once” work most founders skip. Lock this spec, make the dev confirm they understand it in writing, then build.

---

Good, you’re poking exactly where this breaks if we’re sloppy: **sharing vs ownership**.

Let’s lock the rules so your dev can’t “interpret” them.

---

## 1. When a workspace is shared with you

Assuming this is **inside the same organization**:

- You get added as a **member of that workspace**.
- All calls in that workspace:
  - Show up in your **All Calls** view for that org.
  - Show up in that workspace’s view.
- You can:
  - View / search those calls.
  - Use **personal folders/tags** on them.
- You **cannot**:
  - Move those calls between orgs.
  - Change who else has access (unless you’re a workspace/org admin).

**Recommended rule for v1:**  
Reorganization into “favorites” should be done with **personal folders**, not extra workspaces. Workspaces = shared access, folders/tags = personal organization.

That keeps things mentally clean:
- Workspaces = “who can see this.”
- Folders/tags = “how I like to see this.”

---

## 2. What happens when you’re removed from that workspace?

Clean rule:

- As soon as you’re removed from that workspace:
  - Those calls **disappear** from your All Calls and workspace view.
  - Any personal folders/tags that referenced those calls now just stop showing them (no extra logic, they just fail the access check).

You **do not** need some special “auto-delete from their org” behavior, because:

- You never actually moved the calls into “your” org; you only had **access to the owner’s org data**.
- The owner already has “ultimate control”: kill your membership, you lose access everywhere those calls appear for you.

If / when you later support **cross-org copying**:

- “Copy to my org” = create a **new call** in my org.
- If the original sharer revokes access, my **copy stays**. That’s the point of a copy: independent data.

Trying to have an org reach into another org and delete things automatically is a huge headache and weird from a data-ownership standpoint. Don’t do that.

---

## 3. What to tell the dev, verbatim

Add this to the spec:

> - When a user is added to a workspace, all calls in that workspace appear in their **All Calls** view for that organization.  
> - Users can organize those calls using **personal folders and tags only**; by default, they cannot change which workspaces the call belongs to unless they are workspace/org admins.  
> - Removing a user from a workspace instantly revokes access to those calls in **all** their views. Any personal folders/tags that referenced those calls simply stop showing them because the underlying access check fails. No extra cascading delete logic.  
> - Cross-organization behavior (future):  
>   - “Share” = give view access into the original org (guest / link).  
>   - “Copy to my org” = new call in the target org; original org cannot auto-delete it.  
> - All table / field names in this spec (`organizations`, `workspaces`, `calls`, `call_workspace_links`, etc.) are **conceptual**. Map them to our actual schema and naming before coding. Do not assume 1:1 name matches.

---

If you follow this:

- Org = data ownership boundary.  
- Workspace = access boundary.  
- Folders/tags = personal organization.  

No magic, no spooky cross-org deletes, and no “WTF happened to my calls?” bugs six months from now.