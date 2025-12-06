# FOLDERS VS TAGS

## The Core Distinction

---

## ONE SENTENCE EACH

**FOLDERS** = Where you find it (organization for humans)

**TAGS** = What it is (classification for the system)

---

## THE DIFFERENCE

| | FOLDERS | TAGS |
|--|---------|------|
| **Purpose** | Organize calls for browsing | Classify calls by type |
| **User Question** | "Where do I want to find this?" | "What kind of call is this?" |
| **Controls AI?** | ❌ No—purely visual | ✅ Yes—exclusively |
| **Structure** | Hierarchical (nested) | Flat list |
| **Per Call** | One folder | One tag |
| **Can Auto-Assign?** | ✅ Yes | ✅ Yes |

---

## FOLDERS

### What They Do

Folders are filing cabinets. They control where calls appear when you browse. Nothing else.

### Example Structure

```
📁 Clients
   └── 📁 Acme Corp
   └── 📁 Globex Industries
📁 Programs
   └── 📁 VibeOS Cohort 3
📁 Community
   └── 📁 Free Office Hours
```

### Rules

- One call = one folder
- Nesting allowed (3 levels max)
- Moving calls between folders changes nothing except location
- Deleting a folder doesn't delete calls (they move to Unfiled)

### What Folders DON'T Control

- ❌ AI analysis
- ❌ Prompt selection
- ❌ Reports and dashboards
- ❌ Any system behavior whatsoever

---

## TAGS (CALL TYPES)

### What They Do

Tags tell the system what type of call this is. **All AI behavior routes through tags.** Wrong tag = wrong analysis (or no analysis).

### The 15 Call Types

| Tag | What It Means |
|-----|---------------|
| **TEAM** | Team/founder meetings |
| **COACH (2+)** | Group coaching (paid) |
| **COACH (1:1)** | One-to-one coaching |
| **WEBINAR (2+)** | Large group events, webinars |
| **SALES (1:1)** | One-to-one sales calls |
| **EXTERNAL** | Podcasts, collabs, guest appearances |
| **DISCOVERY** | Pre-sales, triage, setter calls |
| **ONBOARDING** | Platform onboarding with new clients |
| **REFUND** | Refund/retention/cancellation calls |
| **FREE** | Free community/group calls |
| **EDUCATION** | Personal education (coaching you attend) |
| **PRODUCT** | Product demos, walkthroughs |
| **SUPPORT** | Customer support, tech issues, training |
| **REVIEW** | Testimonials, reviews, feedback sessions |
| **STRATEGY** | Internal mission, vision, strategy |

### Rules

- One call = one primary tag
- Tags control which AI prompts/analysis run
- Changing a tag changes what intelligence gets extracted

### What Tags CONTROL

- ✅ Which AI prompts execute
- ✅ What analysis gets generated
- ✅ What shows up in reports/dashboards
- ✅ All system behavior for that call

---

## AUTOMATION

Both folders AND tags can be auto-assigned based on rules. The difference is what happens after.

### Folder Automation

Auto-sorts calls into the right place. **No AI impact.**

```
IF participant email contains "@acme.com"
THEN folder = /Clients/Acme Corp
```

### Tag Automation

Auto-classifies calls so the right AI runs. **Controls everything.**

```
IF title contains "coaching" OR "session"
THEN tag = COACH (1:1)
```

---

## THE GOLDEN RULE

**Tags are the ONLY thing that controls AI behavior.**

Folders, filters, views, search—none of it affects what analysis runs. Only tags.

- Want different AI output? → Change the tag.
- Want calls organized differently? → Change the folder.

They're independent. That's the point.

---

## QUICK MENTAL MODEL

| I want to... | Change the... |
|--------------|---------------|
| Find this call easier | FOLDER |
| Get different AI analysis | TAG |
| Auto-sort incoming calls | FOLDER rules |
| Auto-run the right AI | TAG rules |

---

*End of spec*
