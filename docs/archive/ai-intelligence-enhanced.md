# 🧠 AI Intelligence Platform: TWINE-Inspired Architecture

## 🎯 Vision Statement

**Transform Fathom calls into actionable intelligence through elegant, agent-powered automation.**

"No calls = No intel. Let's change that."

---

## 📐 Design Philosophy (Inspired by TWINE)

### 1. **Agent-First Architecture**
- Users create and manage AI "agents" that run automatically
- Each agent has a specific purpose (like TWINE's "Feed agents" and "Thematic agents")
- Visual workflow builder for agent configuration
- Progressive disclosure: Simple start → Advanced options

### 2. **Context-Centric Organization**
```
┌─────────────────────────────────────────────────┐
│  Context                                        │
│  Everything your agents leverage to power       │
│  insights, actions, and alerts.                 │
│                                                 │
│  Defined by you    │    Discovered by AI       │
│  ─────────────────────────────────────────      │
│  Company           │    Intel    Calls         │
│                    │    Customers              │
└─────────────────────────────────────────────────┘
```

### 3. **Intel Cards** (Not tables)
- Each AI-extracted insight is a **card**
- Shows: Type, Title, Summary, Source Call, Date, Priority
- Filterable by type, date, priority, call owner
- Click to expand for full details + take action

### 4. **Clean, Minimalist UI**
- Icon-based sidebar navigation
- Generous white space
- Clear typography hierarchy
- Subtle animations (fade-in for intel cards)
- Beautiful empty states with illustrations

---

## 🗂️ Information Architecture

### Navigation Structure:

```
├─ 🏠 Home (Dashboard overview)
├─ 🤖 Agents (Create & manage AI agents)
├─ 🔌 Connectors (Fathom, GHL, Slack integrations)
└─ 📊 Context
   ├─ Company (Your business info)
   ├─ Intel (AI-discovered insights) ⭐
   ├─ Calls (Raw transcript library)
   └─ Customers (CRM/Contacts)
```

**Key Change**: Rename "Contacts" → "Customers" (aligns with TWINE's B2B focus)

---

## 🤖 Agent Types

### **Feed Agents** (Continuous monitoring)
- Run automatically on every new call
- Deliver intel via Slack/Email/Dashboard
- Examples:
  - **"Deal Signal Monitor"** - Alerts when budget/timeline mentioned
  - **"At-Risk Customer Alert"** - Flags negative sentiment or churn signals
  - **"Action Item Extractor"** - Pulls tasks and assigns them
  - **"Competitive Intel Feed"** - Notifies when competitors mentioned

### **Thematic Agents** (Scheduled reports)
- Run weekly/monthly on batches of calls
- Generate comprehensive reports
- Examples:
  - **"Weekly Product Feedback Digest"** - All feature requests and bugs
  - **"Voice of Customer Report"** - Pain points and themes
  - **"Customer Health Scorecard"** - Engagement trends by customer
  - **"Sales Pipeline Velocity"** - Deal progression analysis

---

## 🎨 UI Components Redesign

### 1. **Intel Tab** (Primary Discovery View)

```
┌───────────────────────────────────────────────────────────┐
│  Intel                                                    │
│  Everything your agents discover automatically            │
├───────────────────────────────────────────────────────────┤
│  Sort: Date ▼    Type: Any ▼    Priority: All ▼          │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Nov 7    Product feedback                    ⚠️ Critical│
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Airtable AI Produces Poor Results                   │ │
│  │                                                      │ │
│  │ A member reported that while Airtable has AI         │ │
│  │ functionality built in, the quality of output they're│ │
│  │ getting from it is not good. They're still in early  │ │
│  │ stages of setting up their...                        │ │
│  │                                                      │ │
│  │ Internal Team Discussion on Book Publishing Nov 5    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  Nov 7    Product feedback                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Multiple features need fixes                         │ │
│  │ The time audit tool has several unspecified issues.. │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  Nov 5    Customer love                          💚      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Self-Paced Learning Platform Works Well             │ │
│  │ A member finds the school platform extremely useful..│ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  [Load more]                                              │
└───────────────────────────────────────────────────────────┘
```

### 2. **Create Agent Flow** (Visual Pipeline)

```
┌─────────────────────────────────────────────┐
│  Feed agent · Private                       │
│  Customer Health Monitor                    │
├─────────────────────────────────────────────┤
│                                             │
│  🎯  Find new [Product feedback ▼]         │
│      + Add filter                           │
│                                             │
│  📬  Deliver via [Slack ▼]                 │
│      You'll see up to 12 intel per run      │
│                                             │
│  🔄  Repeat every [Weekday ▼]              │
│      At [9:00 AM ▼]                        │
│                                             │
│  📊  If no new intel is found [Don't send ▼]│
│                                             │
│  [Create Agent]                             │
└─────────────────────────────────────────────┘
```

**Key Pattern**: Visual timeline on left with icons, progressive form on right

### 3. **Connectors Page** (Integration Hub)

```
┌─────────────────────────────────────────────────────────┐
│  Connectors                                             │
│  From your tools to this app—and back again.            │
├─────────────────────────────────────────────────────────┤
│  Sources                                                │
│  ───────────────────────────────────────────────────── │
│  No calls = No intel.        [Sync calls ▼]            │
│  Let's change that.                                     │
│                                                         │
│  Connect a call source and we'll automatically extract  │
│  intel from all your team's calls.                      │
│                                                         │
│  No call tool? No problem.     [Connect calendar ▼]    │
│  ───────────────────────────────────────────────────── │
│                                                         │
│  Link to revenue                [Connect CRM ▼]        │
│  Match contacts from calls to accounts in your CRM.     │
│  See feedback impact on revenue and prioritize.         │
│                                                         │
│  ───────────────────────────────────────────────────── │
│  Destinations                                           │
│  ───────────────────────────────────────────────────── │
│  Get critical knowledge delivered where teams work.     │
│  No new logins needed.          [Connect Slack ▼]      │
│                                                         │
│  Coming soon: 📧 💬 📝                                  │
└─────────────────────────────────────────────────────────┘
```

### 4. **Customer/Contact Detail** (Enhanced View)

```
┌─────────────────────────────────────────────────────────┐
│  👤 John Smith                    🔥 Hot · Customer     │
│  john@acmecorp.com                                      │
├─────────────────────────────────────────────────────────┤
│  Business impact                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │  $125,000 ARR  │  3 active projects  │  8 calls  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  Recent intel  (Discovered by AI)                       │
│  ───────────────────────────────────────────────────── │
│  Nov 8   💚 Customer love                               │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Loves the automation features                     │  │
│  │ "The workflow builder saves us hours every week"  │  │
│  │ From: Q4 Business Review                          │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  Nov 6   ⚠️ Product feedback · Critical                │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Reporting dashboard needs improvements            │  │
│  │ Mentioned wanting better export options           │  │
│  │ From: Weekly Sync Call                            │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  [View all intel (24)]                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Enhanced Database Schema

### Core Intelligence Tables:

```sql
-- 1. Intel Items (Primary intelligence store - like TWINE's Intel cards)
CREATE TABLE intel_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  call_recording_id BIGINT REFERENCES fathom_calls(recording_id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Intel Classification
  intel_type TEXT NOT NULL, -- 'product_feedback', 'customer_love', 'competitor_comparison', 'service_feedback', 'deal_signal'
  criticality TEXT, -- 'critical', 'non_critical', 'blocker'
  sentiment TEXT, -- 'positive', 'neutral', 'negative'
  
  -- Content
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_description TEXT,
  quote_from_call TEXT, -- Exact words from transcript
  
  -- Metadata
  generated_by_agent_id UUID REFERENCES ai_agents(id),
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  -- Business Impact
  affected_customers INTEGER DEFAULT 0,
  revenue_impact DECIMAL(10,2),
  priority_score INTEGER, -- 0-100
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AI Agents (User-configurable automation)
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Agent Identity
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL, -- 'feed', 'thematic', 'custom'
  description TEXT,
  icon_emoji TEXT DEFAULT '🤖',
  
  -- Configuration
  intel_types TEXT[], -- What to look for
  filters JSONB, -- {time_range, call_owner, topics}
  
  -- Delivery
  delivery_method TEXT[], -- ['slack', 'email', 'dashboard']
  delivery_config JSONB, -- Slack webhook, email addresses, etc.
  max_items_per_run INTEGER DEFAULT 12,
  
  -- Schedule
  schedule_type TEXT, -- 'realtime', 'hourly', 'daily', 'weekly', 'monthly'
  schedule_time TEXT, -- '9:00 AM', etc.
  schedule_days TEXT[], -- ['monday', 'wednesday', 'friday']
  
  -- Behavior
  if_no_intel TEXT DEFAULT 'dont_send', -- 'dont_send', 'send_empty', 'send_summary'
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Agent Runs (Execution history)
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Results
  intel_found_count INTEGER DEFAULT 0,
  intel_delivered_count INTEGER DEFAULT 0,
  calls_analyzed INTEGER DEFAULT 0,
  
  -- Performance
  execution_time_ms INTEGER,
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6),
  
  -- Delivery
  delivered_via TEXT[], -- ['slack', 'email']
  delivery_status TEXT, -- 'success', 'partial', 'failed'
  delivery_errors JSONB,
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 4. Simplified Action Items (Cleaner than before)
CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  intel_item_id UUID REFERENCES intel_items(id) ON DELETE CASCADE,
  call_recording_id BIGINT REFERENCES fathom_calls(recording_id) ON DELETE CASCADE,
  
  action_text TEXT NOT NULL,
  assigned_to TEXT, -- Email or name
  due_date DATE,
  priority TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  
  status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'cancelled'
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Company Context (User-defined)
CREATE TABLE company_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Company Info
  company_name TEXT,
  company_description TEXT,
  industry TEXT,
  
  -- Internal Domains (for customer detection)
  internal_email_domains TEXT[], -- ['acme.com', 'acmecorp.io']
  
  -- AI Context
  product_positioning TEXT, -- Help AI understand what you sell
  target_customer_profile TEXT, -- Who you sell to
  key_competitors TEXT[], -- Track mentions
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_intel_items_user_type ON intel_items(user_id, intel_type, created_at DESC);
CREATE INDEX idx_intel_items_contact ON intel_items(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_ai_agents_user_active ON ai_agents(user_id, is_active);
CREATE INDEX idx_action_items_status ON action_items(user_id, status, due_date);
```

---

## 🎭 Agent Types & Configuration

### **Feed Agents** (Real-time intelligence)

#### 1. **Critical Feedback Monitor**
```
Find new: Product feedback (Critical only)
Deliver via: Slack
Repeat: Realtime (every new call)
If no intel: Don't send
```

#### 2. **Deal Signal Alert**
```
Find new: All intel where:
  - Budget mentioned
  - Timeline set
  - Decision maker present
Deliver via: Email + Slack
Repeat: Realtime
If no intel: Don't send
```

#### 3. **Customer Love Feed**
```
Find new: Customer love
Deliver via: Slack #wins channel
Repeat: Realtime
If no intel: Don't send
```

#### 4. **Churn Risk Alert**
```
Find new: All intel where:
  - Sentiment: Negative
  - Contact status: Customer
  - Criticality: Critical
Deliver via: Email (to CSM) + Dashboard
Repeat: Realtime
```

### **Thematic Agents** (Scheduled reports)

#### 5. **Weekly Product Feedback Digest**
```
Find new: Product feedback
Time range: Last 7 days
Deliver via: Email (to product team)
Repeat: Weekly, Friday at 5:00 PM
Format: Grouped by theme
```

#### 6. **Monthly Voice of Customer**
```
Find new: All intel types
Time range: Last 30 days
Deliver via: Email (exec team) + Dashboard
Repeat: Monthly, 1st of month at 9:00 AM
Generate: Executive report with trends
```

---

## 🏗️ Edge Functions Architecture

### Agent Execution System:

```typescript
// 1. ai-analyze-call (Entry point - called by Fathom webhook)
serve(async (req) => {
  const { callRecordingId, userId } = await req.json();
  
  // Fetch transcript
  const { data: call } = await supabase
    .from('fathom_calls')
    .select('*')
    .eq('recording_id', callRecordingId)
    .single();
  
  // Get user's company context for better AI analysis
  const { data: companyContext } = await supabase
    .from('company_context')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // Run master intelligence extraction
  const intelligence = await extractAllIntelligence(
    call.full_transcript,
    companyContext
  );
  
  // Create intel items
  for (const intel of intelligence.items) {
    await supabase.from('intel_items').insert({
      user_id: userId,
      call_recording_id: callRecordingId,
      intel_type: intel.type,
      criticality: intel.criticality,
      sentiment: intel.sentiment,
      title: intel.title,
      summary: intel.summary,
      quote_from_call: intel.quote,
      confidence_score: intel.confidence
    });
  }
  
  // Trigger feed agents that match this intel
  await triggerMatchingFeedAgents(userId, intelligence.items);
  
  return new Response(JSON.stringify({ 
    success: true, 
    intelCount: intelligence.items.length 
  }));
});

// 2. ai-master-extractor (The brain - one AI call extracts everything)
async function extractAllIntelligence(transcript: string, context: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  const systemPrompt = `You are an expert business intelligence analyst. Extract ALL meaningful insights from sales/customer calls.

Company Context:
- We are: ${context?.company_description || 'B2B SaaS company'}
- We sell: ${context?.product_positioning || 'Software products'}
- We compete with: ${context?.key_competitors?.join(', ') || 'Various competitors'}
- Internal domains: ${context?.internal_email_domains?.join(', ') || 'Not specified'}

Your job: Extract structured intel items from the call transcript.`;

  const userPrompt = `Analyze this call transcript and extract all intel items:

TRANSCRIPT:
${transcript}

For each intel item you find, provide:
1. Type: product_feedback, customer_love, competitor_comparison, service_feedback, deal_signal, churn_risk
2. Criticality: critical, non_critical, blocker
3. Sentiment: positive, neutral, negative
4. Title: Short, actionable headline (5-8 words)
5. Summary: 1-2 sentence description
6. Quote: Exact words from transcript that support this
7. Confidence: 0.00-1.00 how certain you are this is meaningful
8. Priority: 1-100 business impact score

Also extract:
- Action items with assignees and due dates
- Deal signals (budget, timeline, decision makers)
- Customer impact (which customers affected, revenue at risk)

Return structured JSON.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash", // Balanced speed/quality
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      tools: [intelligenceExtractionTool],
      tool_choice: { type: "function", function: { name: "extract_intelligence" } }
    }),
  });
  
  const result = await response.json();
  return parseIntelligenceFromToolCall(result);
}

// 3. ai-run-agent (Execute scheduled agents)
serve(async (req) => {
  const { agentId } = await req.json();
  
  // Fetch agent config
  const { data: agent } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', agentId)
    .single();
  
  // Fetch intel items matching agent's filters
  let query = supabase
    .from('intel_items')
    .select('*')
    .eq('user_id', agent.user_id)
    .in('intel_type', agent.intel_types);
  
  // Apply time range filter
  if (agent.filters?.time_range) {
    const since = calculateTimeRange(agent.filters.time_range);
    query = query.gte('created_at', since);
  }
  
  const { data: intelItems } = await query.order('created_at', { ascending: false });
  
  // Format and deliver
  if (intelItems.length > 0 || agent.if_no_intel !== 'dont_send') {
    await deliverAgentReport(agent, intelItems);
  }
  
  // Log run
  await supabase.from('agent_runs').insert({
    agent_id: agentId,
    user_id: agent.user_id,
    intel_found_count: intelItems.length,
    intel_delivered_count: intelItems.length,
    execution_time_ms: Date.now() - startTime
  });
  
  return new Response(JSON.stringify({ success: true }));
});

// 4. ai-deliver-to-slack (Slack integration)
async function deliverToSlack(webhookUrl: string, intelItems: any[]) {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🧠 ${intelItems.length} New Intel Items`
      }
    },
    {
      type: "divider"
    }
  ];
  
  for (const item of intelItems.slice(0, 12)) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${item.title}*\n${item.summary}\n_From: ${item.call_title}_`
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "View Call"
        },
        url: item.call_url
      }
    });
  }
  
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks })
  });
}
```

---

## 📱 Page Structure Overhaul

### **1. Intel Page** (New - Primary View)
- Replace current "Dashboard" with "Intel" as the home page
- Show all AI-discovered insights as cards
- Filter by type, date, priority, criticality
- Click card → Expand for details + actions
- "Mark as reviewed" checkbox
- Link to source call and related contact

### **2. Agents Page** (New)
- List of active agents (card-based)
- Each card shows: Name, Type, Status, Last run, Next run, Intel found
- "+ Create Agent" button → Visual workflow builder
- Toggle agents on/off
- View agent execution history

### **3. Connectors Page** (Enhanced)
- Sources: Fathom (OAuth), Calendar sync
- Link to revenue: Connect CRM (GHL) - modal with CRM options
- Destinations: Slack, Email, Teams
- Clear visual separation with descriptions
- Simple CTAs: "Sync calls", "Connect CRM", "Connect Slack"

### **4. Calls Page** (Simplified)
- Just the raw transcript library
- Filterable, searchable
- "Intel extracted" badge showing count
- Click → View call detail with intel overlay

### **5. Customers Page** (Enhanced)
- Keep existing table view
- Add "Intel" column showing count of intel items
- Click customer → Detail view with intel timeline
- Add "Business impact" metrics at top

---

## 🎨 Visual Design Language

### Color System (from TWINE):
```css
/* Intel Type Colors */
--intel-feedback: #F59E0B;      /* Amber */
--intel-love: #10B981;          /* Green */
--intel-comparison: #8B5CF6;    /* Purple */
--intel-churn: #EF4444;         /* Red */
--intel-deal: #3B82F6;          /* Blue */

/* Criticality */
--critical: #EF4444;
--non-critical: #6B7280;
--blocker: #DC2626;

/* Sentiment */
--positive: #10B981;
--neutral: #6B7280;
--negative: #EF4444;
```

### Component Patterns:
1. **Card-based layouts** (not tables) for intel items
2. **Icon-driven navigation** in sidebar
3. **Progressive disclosure** in forms
4. **Visual workflows** for agent creation (vertical timeline with icons)
5. **Inline editing** where possible
6. **Elegant loading states** with illustrations (like TWINE's bird)

---

## 🚀 Implementation Phases (TWINE-Inspired)

### **Phase 1: Foundation** (Week 1)
✅ Database migration (intel_items, ai_agents, action_items, company_context)
✅ Company Context setup page
✅ Master AI extractor edge function
✅ Basic Intel page (card view)

### **Phase 2: Agent System** (Week 2)
✅ Create Agent page with visual workflow builder
✅ Feed agent execution engine
✅ Slack delivery integration
✅ Agent management UI

### **Phase 3: Intelligence Layer** (Week 3)
✅ Enhance intel extraction (better prompts)
✅ Contact linking (auto-associate intel with customers)
✅ Action item extraction
✅ Customer detail view with intel timeline

### **Phase 4: Advanced Agents** (Week 4)
✅ Thematic agents (scheduled reports)
✅ Email delivery
✅ Agent analytics dashboard
✅ Custom agent filters and conditions

---

## 🎯 User Flows

### **First-Time User Experience:**

```
1. [Onboarding]
   → Connect Fathom (OAuth)
   → Set up company context
   → "Intel incoming..." loading state
   → First intel appears automatically
   
2. [Create First Agent]
   → Go to Agents page
   → Click "+ Create Agent"
   → Choose: Feed agent (realtime) or Thematic agent (scheduled)
   → Select intel types to monitor
   → Choose delivery method (Slack recommended)
   → Name it, activate it
   → Done!
   
3. [Daily Usage]
   → Open app → Intel page (default)
   → See new intel cards from overnight calls
   → Review critical items first (red badges)
   → Click to see full context + source call
   → Mark as reviewed
   → Create action items if needed
```

### **Agent Configuration Flow:**

```
Step 1: Agent Type
  ○ Feed agent (continuous)
  ○ Thematic agent (scheduled)

Step 2: Find new...
  ☑️ Product feedback
  ☑️ Customer love
  ☑️ Competitor comparison
  ☐ Service feedback
  ☑️ Deal signals
  [+ Add filter: Only from Customer calls]

Step 3: Deliver via
  ☑️ Slack (#product-intel)
  ☐ Email (product@company.com)
  ☑️ Dashboard

Step 4: Schedule
  Repeat: Every new call (realtime)
  If no intel: Don't send
  Max items per notification: 12

Step 5: Name & Activate
  Agent name: Critical Product Issues
  [✓ Activate immediately]
```

---

## 💡 Key Innovations (Beyond TWINE)

### 1. **AI-Powered Contact Enrichment**
- Automatically link intel to contacts
- Build personality profiles from call patterns
- Update CRM fields with AI-extracted data

### 2. **Business Impact Scoring**
- Each intel item gets a priority score (0-100)
- Based on: Criticality, affected customers, revenue impact, urgency
- Sort intel by impact, not just date

### 3. **Intel Actions**
- Every intel card has quick actions:
  - Create action item
  - Link to customer
  - Share via Slack/Email
  - Add to report
  - Mark as reviewed

### 4. **Contextual AI**
- AI learns from your company context
- Better at identifying what matters to YOUR business
- Personalized intel types based on your industry

### 5. **Intel → CRM Bridge**
- Auto-update customer records with intel
- "Last negative feedback: 3 days ago"
- "Product requests: 5 open items"
- Feed GHL with structured insights

---

## 🎪 Example Intel Cards

### Product Feedback (Critical)
```
┌─────────────────────────────────────────────┐
│ ⚠️ Product feedback · Critical              │
│ Nov 7, 2:34 PM                              │
├─────────────────────────────────────────────┤
│ Airtable AI Produces Poor Results           │
│                                             │
│ A member reported that while Airtable has   │
│ AI functionality built in, the quality of   │
│ output they're getting from it is not good. │
│                                             │
│ Quote: "The AI just doesn't give us         │
│ accurate results..."                        │
│                                             │
│ 👤 From call with: Sarah Chen (Acme Corp)  │
│ 📞 Internal Team Discussion on Book Pub...  │
│                                             │
│ [Create Action] [Link to Contact] [Share]  │
└─────────────────────────────────────────────┘
```

### Customer Love
```
┌─────────────────────────────────────────────┐
│ 💚 Customer love                            │
│ Nov 6, 11:15 AM                             │
├─────────────────────────────────────────────┤
│ AI Prompts Highly Valuable                  │
│                                             │
│ Participant found the AI prompts extremely  │
│ helpful, explaining that while they weren't │
│ trained to use AI, they never knew what to  │
│ say to it. The prompts provided during the  │
│ challenge were a game changer.              │
│                                             │
│ Quote: "The prompts are a game changer"     │
│                                             │
│ 👤 Michael Rodriguez (Beta user)            │
│ 📞 Strategy Sessions and Prompts Loved      │
│                                             │
│ [✓ Mark reviewed] [Share] [Add to report]  │
└─────────────────────────────────────────────┘
```

### Deal Signal
```
┌─────────────────────────────────────────────┐
│ 💰 Deal signal · High priority              │
│ Nov 5, 3:22 PM                              │
├─────────────────────────────────────────────┤
│ Budget Mentioned: $50K-75K Range            │
│                                             │
│ Customer indicated they have budget         │
│ allocated for Q1 2025 in the range of       │
│ $50,000 to $75,000 for this project.        │
│                                             │
│ Quote: "We've got 50 to 75K set aside       │
│ for Q1..."                                  │
│                                             │
│ 💵 Budget: $50,000 - $75,000                │
│ 📅 Timeline: Q1 2025                        │
│ 👤 John Smith (Decision maker) · Acme Corp  │
│ 📞 Enterprise Deal Discussion               │
│                                             │
│ [Create opportunity] [Update CRM] [Notify] │
└─────────────────────────────────────────────┘
```

---

## 🔧 Tool Calling Schema (Structured Output)

```typescript
const intelligenceExtractionTool = {
  type: "function",
  function: {
    name: "extract_intelligence",
    description: "Extract all meaningful business intelligence from a call transcript",
    parameters: {
      type: "object",
      properties: {
        intel_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["product_feedback", "customer_love", "competitor_comparison", "service_feedback", "deal_signal", "churn_risk", "feature_request"]
              },
              criticality: {
                type: "string",
                enum: ["critical", "non_critical", "blocker"]
              },
              sentiment: {
                type: "string",
                enum: ["positive", "neutral", "negative", "mixed"]
              },
              title: { type: "string" },
              summary: { type: "string" },
              quote: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              priority_score: { type: "integer", minimum: 0, maximum: 100 },
              affected_customers: { type: "integer" },
              revenue_impact: { type: "number" }
            },
            required: ["type", "title", "summary", "confidence"]
          }
        },
        action_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string" },
              assigned_to: { type: "string" },
              due_date: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] }
            }
          }
        },
        deal_signals: {
          type: "object",
          properties: {
            budget_mentioned: { type: "number" },
            timeline: { type: "string" },
            decision_makers: { type: "array", items: { type: "string" } },
            competitors_mentioned: { type: "array", items: { type: "string" } },
            buying_signals: { type: "array", items: { type: "string" } }
          }
        }
      },
      required: ["intel_items"]
    }
  }
};
```

---

## 📊 Success Metrics

### User Metrics:
- Time to first intel: < 60 seconds after first call
- Intel review rate: > 80% of items reviewed within 24 hours
- Agent activation rate: > 50% of users create at least 1 agent
- Daily active usage: Users check Intel tab daily

### Technical Metrics:
- Processing time: < 10s per call
- Accuracy: > 90% precision on intel classification
- Cost: < $0.02 per call
- Uptime: 99.5%

---

## 🎁 Immediate Value Props

1. **"Intel incoming..."** - Beautiful loading state while first calls process
2. **Auto-categorized insights** - No manual tagging needed
3. **Slack notifications** - Critical items delivered instantly
4. **Action items extracted** - Never miss a follow-up
5. **Customer 360** - See all intel for each customer in one place

---

**Next Steps**: Ready to implement Phase 1 with TWINE-inspired design system? 🚀
