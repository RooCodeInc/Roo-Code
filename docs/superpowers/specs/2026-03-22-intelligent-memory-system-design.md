# Intelligent Memory System — Design Spec

## Overview

A continuous learning system that analyzes user conversations during active chat sessions and builds a dynamically updating user profile. The profile captures coding preferences, communication style, skill levels, active projects, behavioral patterns, and dislikes — then compiles them into a natural-language section of the system prompt so that Roo's responses adapt to the individual user over time.

The system is invisible by design — no dashboards, no management UI. A green/red toggle on the chat interface is the only surface. The data lives in files users can inspect if curious, but it is not surfaced in the UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ACTIVE CHAT SESSION                         │
│                                                                    │
│  User msg → Roo response → User msg → Roo response → ...          │
│       │                                                            │
│       ▼ (every N user messages, if toggle = ON)                    │
│  ┌──────────────────────┐                                          │
│  │  Message Preprocessor │  ← strips tool blocks, keeps filenames, │
│  │  (rule-based filter)  │    keeps conversational text            │
│  └──────────┬───────────┘                                          │
│             ▼                                                      │
│  ┌──────────────────────┐    ┌─────────────────────┐               │
│  │  Analysis Agent       │◄──│ Existing Memory      │              │
│  │  (cheap LLM via       │   │ (compiled report for │              │
│  │   selected profile)   │   │  dedup/reinforcement) │             │
│  └──────────┬───────────┘    └─────────────────────┘               │
│             ▼                                                      │
│  ┌──────────────────────┐                                          │
│  │  Memory Writer        │  ← inserts/updates/reinforces entries   │
│  │  (structured entries) │                                         │
│  └──────────┬───────────┘                                          │
└─────────────┼──────────────────────────────────────────────────────┘
              ▼
┌──────────────────────────┐
│  SQLite Memory Store     │  ← entries with metadata, scores,
│  (global + workspace)    │    categories, timestamps
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│  Prompt Compiler         │  ← queries top-N entries by score,
│  (score → prose)         │    renders as natural language
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│  System Prompt Assembly  │  ← USER PROFILE & PREFERENCES section
│  (system.ts)             │    inserted after personality traits
└──────────────────────────┘
```

### Key Design Decisions

- **Storage**: SQLite via `better-sqlite3` — enables relational queries for the tiered scoring algorithm, atomic transactions, and clean global+workspace scoping.
- **LLM Provider**: User selects from their existing configuration profiles (no new API key fields). Minimum 50K context window with a soft gate (note + filter, not hard-blocked).
- **Noise Reduction**: Rule-based preprocessing strips tool_use/tool_result blocks, code blocks, and command outputs before the LLM sees anything. File operations are reduced to filename-only references.
- **Memory Scope**: Global base profile + workspace-scoped entries. Global entries follow the user everywhere; workspace entries are project-specific.
- **Privacy**: Enforced at the LLM prompt level. The analysis agent is instructed to never extract personal information (names, emails, keys, health/financial data).
- **Visibility**: Invisible by design. Toggle on chat interface is the only UI surface. Data is in files if users want to look.

---

## Component 1: SQLite Memory Store

**Database location**: `{globalStoragePath}/memory/user_memory.db`

**File**: `src/core/memory/memory-store.ts`

### Schema

#### `memory_categories` table

| Column               | Type             | Description                                |
| -------------------- | ---------------- | ------------------------------------------ |
| `slug`               | TEXT PRIMARY KEY | Category identifier                        |
| `label`              | TEXT NOT NULL    | Display name                               |
| `default_decay_rate` | REAL NOT NULL    | Default decay for entries in this category |
| `priority_weight`    | REAL NOT NULL    | How much this category matters in scoring  |

**Seeded values:**

| Slug                    | Label                     | Decay Rate | Priority Weight |
| ----------------------- | ------------------------- | ---------- | --------------- |
| `coding-style`          | Coding Style              | 0.05       | 0.9             |
| `communication-prefs`   | Communication Preferences | 0.05       | 0.95            |
| `technical-proficiency` | Technical Proficiency     | 0.08       | 0.85            |
| `tool-preferences`      | Tool Preferences          | 0.12       | 0.7             |
| `active-projects`       | Active Projects           | 0.3        | 0.6             |
| `behavioral-patterns`   | Behavioral Patterns       | 0.15       | 0.75            |
| `dislikes-frustrations` | Dislikes & Frustrations   | 0.08       | 0.9             |

#### `memory_entries` table

| Column                | Type              | Description                                        |
| --------------------- | ----------------- | -------------------------------------------------- |
| `id`                  | TEXT PRIMARY KEY  | UUID                                               |
| `workspace_id`        | TEXT NULL         | `NULL` = global, workspace path = workspace-scoped |
| `category`            | TEXT NOT NULL     | FK → `memory_categories.slug`                      |
| `content`             | TEXT NOT NULL     | The learned fact as a concise statement            |
| `significance`        | REAL NOT NULL     | 0.0–1.0, set by analysis agent                     |
| `first_seen`          | INTEGER NOT NULL  | Unix timestamp                                     |
| `last_reinforced`     | INTEGER NOT NULL  | Unix timestamp                                     |
| `reinforcement_count` | INTEGER DEFAULT 1 | Observation count                                  |
| `decay_rate`          | REAL NOT NULL     | Category-based decay multiplier                    |
| `source_task_id`      | TEXT NULL         | Which task/chat produced this                      |
| `is_pinned`           | INTEGER DEFAULT 0 | If 1, immune to decay (future use)                 |

#### `analysis_log` table

| Column               | Type             | Description                    |
| -------------------- | ---------------- | ------------------------------ |
| `id`                 | TEXT PRIMARY KEY | UUID                           |
| `timestamp`          | INTEGER NOT NULL | When the analysis ran          |
| `task_id`            | TEXT NULL        | Which chat session             |
| `messages_analyzed`  | INTEGER NOT NULL | Messages in the batch          |
| `tokens_used`        | INTEGER NOT NULL | Input + output tokens consumed |
| `entries_created`    | INTEGER NOT NULL | New entries                    |
| `entries_reinforced` | INTEGER NOT NULL | Updated entries                |

### Scoring Formula

Computed at query time, not stored:

```
score = significance
        × priority_weight
        × reinforcement_bonus(reinforcement_count)
        × temporal_decay(days_since_reinforced, decay_rate)

where:
  reinforcement_bonus = min(log2(count + 1), 3.0)
  temporal_decay = exp(-decay_rate × days_since_reinforced)
```

Entries with `computed_score < 0.05` are excluded from prompt compilation (noise threshold).

---

## Component 2: Message Preprocessor

**File**: `src/core/memory/preprocessor.ts`

A pure function with zero LLM cost. Takes raw `ApiMessage[]` and returns cleaned conversational text.

### Rules

```
FOR EACH message in the batch:

  IF message.role === "user":
    → KEEP full text content
    → STRIP base64 image data (keep "[image attached]" placeholder)

  IF message.role === "assistant":
    → KEEP text blocks (explanations, questions, summaries)
    → FOR tool_use blocks:
        IF tool === "read_file" / "write_to_file" / "apply_diff":
          → REPLACE with "→ {tool}: {file_path}"
        IF tool === "execute_command":
          → REPLACE with "→ ran command: {command}"
        IF tool === "search_files" / "list_files":
          → REPLACE with "→ searched: {pattern/path}"
        ELSE:
          → STRIP entirely
    → STRIP tool_result blocks entirely
    → STRIP code blocks longer than 3 lines
```

### Output

```typescript
interface PreprocessResult {
	cleaned: string
	originalTokenEstimate: number
	cleanedTokenEstimate: number
}
```

### Example Transformation

**Before** (~4,000 tokens):

```
Assistant: I'll update the auth component to use the new hook pattern.
[tool_use: read_file, path: "src/auth/AuthProvider.tsx"]
[tool_result: 200 lines of code...]
[tool_use: apply_diff, path: "src/auth/AuthProvider.tsx", diff: ...]
[tool_result: success]
[tool_use: execute_command, cmd: "npm test"]
[tool_result: 45 lines of test output...]
Let me know if you'd prefer the context to be passed via props instead.
```

**After** (~120 tokens):

```
Assistant: I'll update the auth component to use the new hook pattern.
→ read: src/auth/AuthProvider.tsx
→ edited: src/auth/AuthProvider.tsx
→ ran command: npm test
Let me know if you'd prefer the context to be passed via props instead.
```

---

## Component 3: Analysis Agent

**File**: `src/core/memory/analysis-agent.ts`

Uses the existing `buildApiHandler()` with the user's selected memory config profile. NOT the main chat flow.

### System Prompt

```
You are a User Profile Analyst. Your job is to extract factual observations
about the USER from conversation transcripts between them and a coding assistant.

You will receive:
1. A cleaned conversation transcript (tool noise already removed)
2. The current compiled memory report (what is already known)

EXTRACT observations about the user in these categories:
- coding-style: Languages, frameworks, patterns, conventions they prefer
- communication-prefs: Response length, tone, detail level they want
- technical-proficiency: Skill levels in specific technologies
- tool-preferences: Tools, linters, formatters, workflows they favor
- active-projects: What they're currently building (time-bound)
- behavioral-patterns: How they iterate, review, debug, make decisions
- dislikes-frustrations: Things that annoy them or they explicitly reject

RULES:
- Only extract what is EVIDENCED in the transcript. Never infer beyond what's shown.
- If an observation matches something in the existing memory, mark it as REINFORCE
  (don't create a duplicate).
- If an observation contradicts existing memory, mark it as UPDATE with the new value.
- If it's completely new, mark it as NEW.
- Write each observation as a concise, third-person factual statement
  (e.g., "Prefers functional React components over class components")
- Assign significance 0.0-1.0 based on how broadly useful this fact is
  for future interactions.

PRIVACY — NEVER extract:
- Real names, emails, addresses, phone numbers
- API keys, passwords, secrets, tokens
- Company confidential or proprietary details
- Health, financial, legal, or relationship information
- Anything the user explicitly marks as private or off-record

If the conversation contains mostly one-liners or nothing personality-revealing,
return an empty observations array. Don't force extraction.

Respond in this exact JSON format:
{
  "observations": [
    {
      "action": "NEW" | "REINFORCE" | "UPDATE",
      "category": "<category-slug>",
      "content": "<concise factual statement>",
      "significance": <0.0-1.0>,
      "existing_entry_id": "<id if REINFORCE or UPDATE, null if NEW>",
      "reasoning": "<one sentence why this matters>"
    }
  ],
  "session_summary": "<1-2 sentences about what the user was doing this session>"
}
```

### Token Budget Allocation

| Component                    | Estimated Budget       |
| ---------------------------- | ---------------------- |
| System prompt (instructions) | ~1,500 tokens          |
| Existing memory report       | ~2,000–4,000 tokens    |
| Cleaned conversation batch   | ~5,000–15,000 tokens   |
| Output (observations JSON)   | ~2,000–4,000 tokens    |
| Buffer                       | ~25,000+ tokens        |
| **Total**                    | **~50,000 tokens max** |

### Overflow Handling

If the cleaned conversation batch exceeds the budget, truncate from oldest messages first (newest messages are more valuable for learning).

### Error Handling

- API failure: log, skip cycle, continue counting
- JSON parse failure: log, skip cycle
- Never surface errors to user

---

## Component 4: Memory Writer

**File**: `src/core/memory/memory-writer.ts`

Takes the analysis agent's structured JSON output and upserts entries into SQLite.

### Operations by Action Type

**NEW**: Insert with UUID, current timestamps, category default decay rate. Workspace scoping logic:

- `active-projects` → always workspace-scoped
- `coding-style`, `communication-prefs`, `dislikes-frustrations` → always global
- `technical-proficiency`, `tool-preferences`, `behavioral-patterns` → global by default, workspace-scoped if content references project-specific paths

**REINFORCE**: Update `last_reinforced` timestamp and increment `reinforcement_count`. Significance is NOT overwritten.

**UPDATE**: Replace `content` and `significance`, update `last_reinforced`, increment `reinforcement_count`. For when user preferences genuinely change.

### Deduplication Safety

Before inserting any NEW entry, query existing entries in the same category and workspace scope. Run basic string similarity check (normalized Levenshtein or keyword overlap). If similarity > 0.7, convert the NEW to a REINFORCE on the matched entry.

### Transaction Safety

All inserts/updates/log entry run inside a single SQLite transaction via `better-sqlite3`'s `db.transaction()`. Full rollback on any failure.

---

## Component 5: Prompt Compiler

**File**: `src/core/memory/prompt-compiler.ts`

Runs every time the system prompt is assembled — not just after analysis cycles.

### Pipeline

1. **Query and score**: Select all global + current workspace entries, compute score via the scoring formula, filter by `> 0.05` threshold, order by score descending, limit 40 entries.

2. **Group by category**: Organize scored entries into their categories, maintaining score order within each group. Omit empty categories.

3. **Render as prose**: Each category becomes a natural-language paragraph:

```
USER PROFILE & PREFERENCES
(Learned through conversation — continuously updated)

Communication: Prefers concise, direct responses without over-explanation.
Appreciates when complex topics are broken into numbered steps.

Coding Style: Strongly favors functional React with hooks over class
components. Uses TypeScript strictly — no 'any' types.

Technical Level: Advanced TypeScript and React. Intermediate Python.

...
```

4. **Token cap**: Maximum ~1,500 tokens for the entire section. Drop lowest-scored entries until it fits.

### System Prompt Integration

Injected in `system.ts`'s `generatePrompt()`:

```
${roleDefinition}
${personalityParts.top}          ← how Roo talks (static traits)
${userProfileSection}            ← who Roo is talking to (learned memory)
${markdownFormattingSection}
...
${personalityParts.bottom}       ← personality reminder
```

### Analysis Agent Variant

For the analysis agent, render entries with IDs visible:

```
[e3f2a1] coding-style (score: 0.87): Prefers functional React with hooks
[b7c4d9] communication-prefs (score: 0.92): Likes concise responses
```

---

## Component 6: Toggle UI

### Chat Interface Toggle

**File**: `webview-ui/src/components/chat/ChatTextArea.tsx`

A small, always-visible indicator near the chat input:

- **Green dot** + "Memory Learning" when active
- **Red dot** + "Memory Paused" when off
- **Grey dot** + "Memory: Not configured" when no profile selected
- Click to toggle on/off
- Tooltip: "Roo learns your preferences from this conversation. Click to pause."
- Clicking grey state prompts: "Select a model profile in Mode Settings → Memory to enable."

State persisted in `globalState` as `memoryLearningEnabled: boolean`.

### Settings Configuration

**File**: `webview-ui/src/components/modes/ModesView.tsx`

New section in mode settings:

```
Memory Learning
├── Profile: [Select configuration profile ▼]
│             Filtered to profiles with models ≥ 50K context
│             Note: "Select a model with at least 50K context window"
├── Analysis frequency: [Every __ messages ▼]  (default: 8)
└── [Enabled by default for new sessions: ☑]
```

### Global Settings Additions

In `globalSettingsSchema`:

```typescript
memoryLearningEnabled: z.boolean().optional()
memoryApiConfigId: z.string().optional()
memoryAnalysisFrequency: z.number().optional()
memoryLearningDefaultEnabled: z.boolean().optional()
```

---

## Component 7: Pipeline Orchestrator

**File**: `src/core/memory/orchestrator.ts`

Coordinates the full pipeline lifecycle.

### Lifecycle

```
1. INITIALIZATION (on extension activate)
   → Open/create SQLite database
   → Seed categories table if empty
   → Load memoryLearningEnabled from globalState

2. MESSAGE COUNTER (during active chat, if toggle = ON)
   → Increment counter on each user message
   → Track watermark: which message index was last analyzed

3. TRIGGER (counter hits N threshold)
   → Grab messages from watermark to current
   → Validate: is config profile selected? Is context window ≥ 50K?
   → If invalid: skip silently, reset counter

4. ANALYSIS PIPELINE (async, non-blocking)
   → preprocessMessages(batch) → cleaned text + token counts
   → compileExistingMemory(withIds: true) → current report for agent
   → Budget check: cleaned + report + instructions < context budget?
     → If over: truncate oldest messages, retry
     → If still over: skip this cycle, log it
   → buildApiHandler(selectedProfile) → handler
   → handler.createMessage(analysisPrompt, messages)
   → Parse JSON response
   → memoryWriter.process(observations)
   → Log to analysis_log
   → Reset counter and watermark

5. TOGGLE CHANGE
   → Update globalState
   → If OFF: stop counting, ignore triggers
   → If ON: resume counting from current message

6. ERROR HANDLING
   → API failure: log, skip cycle, continue counting
   → JSON parse failure: log, skip cycle
   → DB error: log, disable pipeline until restart
   → Never surface errors to user
```

### Non-Blocking Guarantee

The analysis pipeline runs fully async and detached from the chat flow. The user's conversation is never blocked or slowed.

### Concurrency Guard

Only one analysis runs at a time. If a trigger fires during an in-flight analysis, it queues (max one queued). If another is already queued, the new trigger is dropped.

---

## File Structure

### New Files

```
src/core/memory/
├── orchestrator.ts              # Pipeline coordinator, lifecycle, triggers
├── preprocessor.ts              # Rule-based message noise filter
├── analysis-agent.ts            # LLM invocation, prompt, response parsing
├── memory-writer.ts             # Observation → SQLite upsert logic
├── prompt-compiler.ts           # Score query → natural language prose
├── memory-store.ts              # SQLite connection, schema init, queries
├── scoring.ts                   # Score computation helpers, decay formula
├── types.ts                     # MemoryEntry, Observation, AnalysisResult
└── __tests__/
    ├── preprocessor.spec.ts
    ├── memory-writer.spec.ts
    ├── prompt-compiler.spec.ts
    ├── scoring.spec.ts
    └── orchestrator.spec.ts
```

### Modified Files

```
packages/types/src/global-settings.ts         # + memory settings fields
packages/types/src/vscode-extension-host.ts   # + memory message types
src/core/prompts/system.ts                    # + userProfileSection insertion
src/core/prompts/sections/index.ts            # + re-export prompt compiler
src/core/webview/ClineProvider.ts             # + orchestrator init, toggle
src/core/webview/webviewMessageHandler.ts     # + toggleMemoryLearning msg
webview-ui/src/components/chat/ChatTextArea.tsx    # + toggle indicator
webview-ui/src/components/modes/ModesView.tsx      # + memory config section
package.json                                  # + better-sqlite3 dependency
```

### Runtime Files

```
{globalStoragePath}/memory/user_memory.db     # SQLite database
```

---

## Testing Strategy

- **Preprocessor**: Pure function, fully unit testable. Test with various message shapes (tool-heavy, conversational, mixed, edge cases like empty messages and image-only).
- **Scoring**: Pure math, unit test the formula edge cases (zero reinforcement, extreme decay, pinned entries).
- **Memory Writer**: Test with mock DB — verify NEW/REINFORCE/UPDATE logic, deduplication, transaction rollback.
- **Prompt Compiler**: Test rendered output format, token budget enforcement, category grouping, empty state.
- **Orchestrator**: Integration test with mock API handler and in-memory SQLite — verify trigger counting, concurrency guard, error recovery.

---

## Open Questions for Experimentation

These are intentionally left as tunable parameters rather than hard commitments:

1. **Analysis frequency (N messages)**: Default 8, but may need adjustment based on analysis_log data showing token consumption per cycle.
2. **Scoring weights**: The decay rates and priority weights are initial guesses. The analysis_log provides data to tune them.
3. **50K context minimum**: May need revision upward or downward based on real-world token usage logs.
4. **Deduplication threshold (0.7 similarity)**: May need tuning to balance between catching duplicates and false-merging distinct entries.
5. **Prompt section token cap (1,500)**: Balance between giving Roo enough user context and not bloating the system prompt.
