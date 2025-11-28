# WORKFLOW GUIDE V2: 10-20X PARALLEL AGENT ORCHESTRATION

**Philosophy**: Stop thinking sequentially. Every task is an opportunity for parallel execution.

---

## THE 10X MINDSET SHIFT

### OLD WAY (1x Speed)
```
Research → Design → Implement → Test → Review → Done
(Sequential, one thing at a time)
```

### NEW WAY (10-20x Speed)
```
┌─────────────────────────────────────────────────────────┐
│  WAVE 1: PARALLEL DISCOVERY (3 agents)                  │
│  ├── Agent 1: Explore existing patterns                 │
│  ├── Agent 2: Research external docs/libraries          │
│  └── Agent 3: Analyze affected systems/dependencies     │
└─────────────────────────────────────────────────────────┘
                          ↓ CHECKPOINT
┌─────────────────────────────────────────────────────────┐
│  WAVE 2: PARALLEL DESIGN + PREP (3 agents)              │
│  ├── Agent 1: Design component architecture             │
│  ├── Agent 2: Design API/data layer                     │
│  └── Agent 3: Design test strategy                      │
└─────────────────────────────────────────────────────────┘
                          ↓ CHECKPOINT
┌─────────────────────────────────────────────────────────┐
│  WAVE 3: PARALLEL IMPLEMENTATION (3+ agents)            │
│  ├── Agent 1: Implement frontend components             │
│  ├── Agent 2: Implement backend/Edge Functions          │
│  ├── Agent 3: Implement database migrations             │
│  └── Agent 4: Write tests in parallel                   │
└─────────────────────────────────────────────────────────┘
                          ↓ CHECKPOINT
┌─────────────────────────────────────────────────────────┐
│  WAVE 4: PARALLEL VALIDATION (3 agents)                 │
│  ├── Agent 1: /code-review                              │
│  ├── Agent 2: /security-review                          │
│  └── Agent 3: /design-review + Playwright               │
└─────────────────────────────────────────────────────────┘
                          ↓ MERGE & SHIP
```

---

## CORE PRINCIPLE: WAVE → CHECKPOINT → WAVE

**WAVE**: Spawn maximum parallel agents for independent work
**CHECKPOINT**: Sync results, resolve conflicts, make decisions
**WAVE**: Launch next parallel wave with checkpoint outputs

### Token ROI
- Sequential: 50,000 tokens over 2 hours
- Parallel Waves: 50,000 tokens in 20 minutes (same cost, 6x faster)

---

## ULTRA-PARALLEL WORKFLOWS

### 1. FEATURE DEVELOPMENT (10x Pattern)

**You say:**
```
"Build [feature] - use parallel agents"
```

**Claude executes:**

```
WAVE 1: Discovery (Single message, 3 parallel Task calls)
├── Task(Explore): "Find all existing patterns for [similar feature]"
├── Task(Explore): "Map all files that will need changes"
└── Task(Explore): "Research [any external libs/APIs needed]"

CHECKPOINT: Synthesize findings, create implementation plan

WAVE 2: Implementation (Single message, 3-4 parallel Task calls)
├── Task(general-purpose): "Implement [frontend component] following [patterns]"
├── Task(general-purpose): "Create Edge Function [backend logic]"
├── Task(general-purpose): "Write database migration for [schema]"
└── Task(general-purpose): "Generate tests for [feature]"

CHECKPOINT: Integrate all pieces, resolve any conflicts

WAVE 3: Validation (Single message, 3 parallel SlashCommand calls)
├── /code-review
├── /security-review
└── /conversion-brain-commands:brain-ui-consistency-review
```

**Result**: 3-4 hour feature in 30-45 minutes

---

### 2. BUG INVESTIGATION (5x Pattern)

**You say:**
```
"Debug [issue] - investigate in parallel"
```

**Claude executes:**

```
WAVE 1: Parallel Investigation
├── Task(Explore): "Search for error patterns in logs/code"
├── Task(Explore): "Find recent changes to affected area"
├── Task(Explore): "Check related systems for side effects"
└── Direct: Check runtime state with Playwright

CHECKPOINT: Correlate findings, identify root cause

WAVE 2: Fix + Validate
├── Direct: Implement fix
├── Task(general-purpose): "Write regression test"
└── Task(general-purpose): "Check for similar issues elsewhere"
```

**Result**: 2-hour debug session in 20-30 minutes

---

### 3. CODEBASE UNDERSTANDING (10x Pattern)

**You say:**
```
"I need to understand [system/feature] deeply - parallel exploration"
```

**Claude executes:**

```
WAVE 1: Multi-Angle Exploration
├── Task(Explore): "Map the data flow from UI to database"
├── Task(Explore): "Document all entry points and APIs"
├── Task(Explore): "Find all configuration and environment dependencies"
└── Task(Explore): "Identify all external service integrations"

CHECKPOINT: Create unified architecture diagram/documentation
```

**Result**: Full system understanding in 10-15 minutes vs 1+ hour

---

### 4. REFACTORING (15x Pattern)

**You say:**
```
"Refactor [system] - parallel analysis and execution"
```

**Claude executes:**

```
WAVE 1: Analysis
├── Task(Explore): "Map all usages and dependencies"
├── Task(Explore): "Identify code smells and improvement opportunities"
├── Task(Explore): "Find test coverage gaps"
└── /sc:analyze [path] --focus architecture

CHECKPOINT: Create refactoring plan with independent chunks

WAVE 2: Parallel Refactoring (chunks with no dependencies)
├── Task(general-purpose): "Refactor chunk A [specific files]"
├── Task(general-purpose): "Refactor chunk B [specific files]"
├── Task(general-purpose): "Refactor chunk C [specific files]"
└── Task(general-purpose): "Update/add tests for all chunks"

CHECKPOINT: Integrate, resolve conflicts

WAVE 3: Validation
├── /code-review
├── /security-review
└── Run full test suite
```

**Result**: Major refactor in 1 hour vs full day

---

### 5. NEW PROJECT ONBOARDING (20x Pattern)

**You say:**
```
"I'm new to this codebase - give me full parallel onboarding"
```

**Claude executes:**

```
WAVE 1: Comprehensive Discovery
├── Task(Explore): "Document project structure and architecture"
├── Task(Explore): "Map all key abstractions and patterns"
├── Task(Explore): "List all external dependencies and integrations"
├── Task(Explore): "Find all configuration and environment setup"
└── Task(Explore): "Document testing patterns and how to run tests"

CHECKPOINT: Create comprehensive onboarding document

WAVE 2: Deep Dives (parallel)
├── Task(Explore): "Deep dive: Authentication system"
├── Task(Explore): "Deep dive: Data fetching patterns"
├── Task(Explore): "Deep dive: UI component system"
└── Task(Explore): "Deep dive: Edge Functions architecture"

OUTPUT: Complete project understanding in 15-20 minutes
```

---

## AGENT SPAWN PATTERNS

### Pattern 1: Explore Swarm
Use for understanding before acting:
```
YOU: "Before implementing, explore in parallel: [specific questions]"

CLAUDE: Spawns 3 Explore agents with specific focus areas
```

### Pattern 2: Implementation Army
Use for multi-file features:
```
YOU: "Implement these independently in parallel:
- Component A in [file]
- Component B in [file]
- Edge Function C
- Tests for all"

CLAUDE: Spawns 4 general-purpose agents, each with specific deliverable
```

### Pattern 3: Review Battalion
Use before any merge:
```
YOU: "Run all reviews in parallel"

CLAUDE: Simultaneously runs:
- /code-review
- /security-review
- /conversion-brain-commands:brain-ui-consistency-review
```

### Pattern 4: Research Squad
Use for unfamiliar territory:
```
YOU: "Research [topic] from multiple angles in parallel"

CLAUDE: Spawns agents for:
- Official documentation
- GitHub examples
- Stack Overflow patterns
- Existing codebase usage
```

---

## MAGIC PHRASES THAT TRIGGER PARALLEL EXECUTION

Add these to your requests:

| Phrase | Effect |
|--------|--------|
| "in parallel" | Spawns multiple agents simultaneously |
| "parallel agents" | Explicit multi-agent request |
| "wave pattern" | Uses Wave → Checkpoint → Wave |
| "explore from multiple angles" | 3+ Explore agents |
| "implement independently" | Parallel implementation agents |
| "all reviews simultaneously" | Parallel review commands |
| "10x this" | Maximum parallelization |

---

## CONVERSATION STARTERS FOR 10X MODE

### Feature Development
```
"Build [feature]. Use parallel waves:
Wave 1: 3 agents explore patterns, dependencies, and APIs
Wave 2: Parallel implementation of frontend, backend, and tests
Wave 3: All reviews in parallel
Let's crush this."
```

### Bug Fix
```
"Debug [issue]. Parallel investigation:
- Search for error patterns
- Check recent changes
- Analyze related systems
Then fix and validate."
```

### Refactoring
```
"Refactor [system]. Parallel approach:
1. Multi-agent analysis of dependencies and usages
2. Break into independent chunks
3. Parallel refactoring of each chunk
4. Parallel reviews"
```

### Learning/Onboarding
```
"I need to understand [system] fast. Spawn parallel Explore agents for:
- Architecture and data flow
- Key patterns and conventions
- External integrations
- Configuration and setup"
```

---

## DEPENDENCY MAPPING: WHAT CAN RUN IN PARALLEL

### Always Parallel-Safe
- Reading different files
- Exploring different parts of codebase
- Running different review commands
- Researching different topics
- Writing to different files

### Requires Sequencing
- File A depends on File B → B first, then A
- Tests depend on implementation → impl first (or parallel if mocked)
- Migration depends on schema design → design first

### Smart Chunking
Break work into independent pieces:
```
Feature: User Profile Page
├── Chunk A: Profile display component (independent)
├── Chunk B: Profile edit form (independent)
├── Chunk C: Avatar upload (independent)
├── Chunk D: Edge Function for profile API (independent)
└── Chunk E: Integration/E2E tests (depends on A-D)

→ Run A, B, C, D in parallel
→ Then E after checkpoint
```

---

## REAL EXAMPLES

### Example 1: Build Settings Page Feature

**You:**
```
Build a new "Notification Preferences" section in Settings. Use parallel waves.
```

**Claude Executes:**

**WAVE 1** (3 parallel Explore agents):
- Agent 1: Explore existing Settings page patterns
- Agent 2: Find notification-related code and schemas
- Agent 3: Check brand guidelines for settings UI

**CHECKPOINT**: Plan with patterns, identify all files

**WAVE 2** (4 parallel implementation agents):
- Agent 1: NotificationPreferences component
- Agent 2: Edge Function save-notification-preferences
- Agent 3: Database migration for preferences table
- Agent 4: Unit tests for new functionality

**CHECKPOINT**: Integrate, wire up

**WAVE 3** (3 parallel reviews):
- /code-review
- /security-review
- /brain-ui-consistency-review

**Total time: 30-40 minutes** (vs 3-4 hours sequential)

---

### Example 2: Debug Complex Issue

**You:**
```
Calls aren't syncing properly. Parallel debug investigation.
```

**Claude Executes:**

**WAVE 1** (4 parallel investigations):
- Agent 1: Check sync Edge Functions for errors
- Agent 2: Review recent changes to sync code
- Agent 3: Analyze Fathom webhook handling
- Agent 4: Check database for sync state inconsistencies

**CHECKPOINT**: Correlate findings → Root cause identified

**WAVE 2** (2 parallel):
- Direct: Implement fix
- Agent: Write regression test + check for similar issues

**Total time: 15-20 minutes** (vs 1-2 hours)

---

### Example 3: Major Refactoring

**You:**
```
Refactor the FilterBar component (700+ lines). Parallel approach.
```

**Claude Executes:**

**WAVE 1** (3 parallel analysis):
- Agent 1: Map all FilterBar usages and props
- Agent 2: Identify extraction opportunities (sub-components)
- Agent 3: Analyze test coverage gaps

**CHECKPOINT**: Refactoring plan with 5 independent chunks

**WAVE 2** (5 parallel extractions):
- Agent 1: Extract CategoryFilter component
- Agent 2: Extract DateRangeFilter component
- Agent 3: Extract ParticipantFilter component
- Agent 4: Extract DurationFilter component
- Agent 5: Create shared filter hook

**CHECKPOINT**: Integrate, update parent component

**WAVE 3** (parallel validation):
- Run tests
- /code-review
- /brain-ui-consistency-review

**Total time: 45-60 minutes** (vs 4-6 hours)

---

## MAXIMIZING AGENT EFFICIENCY

### 1. Be Specific in Agent Prompts
```
BAD: "Explore the codebase"
GOOD: "Find all files that handle user authentication, map the auth flow from login to session storage, list all auth-related hooks"
```

### 2. Give Clear Deliverables
```
BAD: "Implement the feature"
GOOD: "Implement NotificationToggle component in src/components/settings/ following the existing Toggle pattern from IntegrationsTab.tsx, export from index.ts"
```

### 3. Set Boundaries
```
"Implement ONLY [specific scope]. Do not modify [other files]."
```

### 4. Request Checkpoint Summaries
```
"After completing, provide: files changed, key decisions made, any blockers"
```

---

## WHEN TO USE WHAT LEVEL

### Level 1: Direct (Simple tasks)
- Single file edits
- Quick fixes
- Simple questions
**Time: 1-5 minutes**

### Level 2: Single Agent (Focused tasks)
- Single feature implementation
- Targeted investigation
- Specific review
**Time: 10-30 minutes**

### Level 3: Multi-Agent Parallel (Complex tasks)
- Multi-file features
- System-wide changes
- Major refactoring
- Deep debugging
**Time: 30-60 minutes (vs 3-6 hours sequential)**

### Level 4: Wave Pattern (Major projects)
- New major features
- Architecture changes
- Full system onboarding
- Complex migrations
**Time: 1-2 hours (vs full day+ sequential)**

---

## QUICK REFERENCE CARD

```
┌────────────────────────────────────────────────────────────┐
│                    10X WORKFLOW CHEATSHEET                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  TRIGGER PHRASES:                                          │
│  • "parallel agents"    • "wave pattern"                   │
│  • "in parallel"        • "10x this"                       │
│  • "simultaneously"     • "explore from multiple angles"   │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  WAVE PATTERN:                                             │
│  Wave 1: Explore (3 agents) → Checkpoint                   │
│  Wave 2: Implement (3-4 agents) → Checkpoint               │
│  Wave 3: Review (3 parallel commands) → Ship               │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  PARALLEL-SAFE OPERATIONS:                                 │
│  ✓ Reading different files                                 │
│  ✓ Exploring different areas                               │
│  ✓ Writing to different files                              │
│  ✓ Running different reviews                               │
│  ✓ Researching different topics                            │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  AGENT TYPES:                                              │
│  • Explore: Codebase discovery, pattern finding            │
│  • general-purpose: Implementation, complex tasks          │
│  • Plan: Architecture, design decisions                    │
│  • SlashCommands: Reviews, specialized analysis            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## THE ULTIMATE 10X PROMPT

When you want maximum speed, use this template:

```
[TASK DESCRIPTION]

Execute with parallel waves:

WAVE 1 - Discovery (3 parallel Explore agents):
1. [Specific exploration focus 1]
2. [Specific exploration focus 2]
3. [Specific exploration focus 3]

CHECKPOINT: Synthesize findings, create plan

WAVE 2 - Implementation (parallel agents for independent chunks):
1. [Chunk 1 - specific deliverable]
2. [Chunk 2 - specific deliverable]
3. [Chunk 3 - specific deliverable]
4. [Tests for all chunks]

CHECKPOINT: Integrate all pieces

WAVE 3 - Validation (parallel):
1. /code-review
2. /security-review (if auth/data)
3. UI consistency check (if frontend)

Let's 10x this.
```

---

**Remember: The same tokens spent sequentially over 4 hours can be spent in parallel in 30 minutes. Choose parallel.**
