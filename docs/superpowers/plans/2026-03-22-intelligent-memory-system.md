# Intelligent Memory System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a continuous learning system that analyzes user conversations in real-time and dynamically builds a user profile that shapes Roo's system prompt.

**Architecture:** A background pipeline triggered every N user messages: rule-based message preprocessing strips tool noise, a cheap LLM analysis agent extracts user traits, structured entries are stored in SQLite (via sql.js WASM), and a prompt compiler renders top-scored entries as prose injected into the system prompt. A toggle on the chat UI gives users control.

**Tech Stack:** TypeScript, sql.js (SQLite WASM), Vitest, React (webview UI), VS Code extension APIs

**Spec:** `docs/superpowers/specs/2026-03-22-intelligent-memory-system-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `src/core/memory/types.ts` | All TypeScript types/interfaces for the memory system |
| `src/core/memory/memory-store.ts` | SQLite connection, schema init, migrations, CRUD queries |
| `src/core/memory/scoring.ts` | Score computation helpers, decay formula, reinforcement bonus |
| `src/core/memory/preprocessor.ts` | Rule-based message noise filter |
| `src/core/memory/analysis-agent.ts` | LLM invocation, prompt construction, response parsing |
| `src/core/memory/memory-writer.ts` | Observation → SQLite upsert logic, PII filter, dedup |
| `src/core/memory/prompt-compiler.ts` | Score query → natural language prose for system prompt |
| `src/core/memory/orchestrator.ts` | Pipeline coordinator, lifecycle, triggers, concurrency |
| `src/core/memory/__tests__/scoring.spec.ts` | Scoring formula unit tests |
| `src/core/memory/__tests__/preprocessor.spec.ts` | Preprocessor unit tests |
| `src/core/memory/__tests__/memory-writer.spec.ts` | Writer logic unit tests |
| `src/core/memory/__tests__/prompt-compiler.spec.ts` | Compiler unit tests |
| `src/core/memory/__tests__/orchestrator.spec.ts` | Orchestrator integration tests |

### Modified Files

| File | Changes |
|---|---|
| `package.json` (root) | Add `sql.js` dev dependency |
| `src/package.json` | Add `sql.js` dependency |
| `packages/types/src/global-settings.ts:238-241` | Add memory settings fields to `globalSettingsSchema` |
| `packages/types/src/vscode-extension-host.ts:107,586` | Add memory message types |
| `src/core/prompts/system.ts:94-95` | Insert `userProfileSection` between personality top and markdown formatting |
| `src/core/prompts/sections/index.ts:11` | Add `getUserProfileSection` export |
| `src/core/webview/ClineProvider.ts:176-256` | Initialize orchestrator in constructor |
| `src/core/webview/webviewMessageHandler.ts:3696` | Add `toggleMemoryLearning` case |
| `webview-ui/src/components/chat/ChatTextArea.tsx:1326` | Add memory toggle indicator |
| `webview-ui/src/components/settings/SettingsView.tsx:98-115,509-528` | Add memory settings section |
| `src/esbuild.mjs:66-69` | Ensure sql.js WASM files are copied via `copyWasms` |

---

## Task 1: Types & Interfaces

**Files:**
- Create: `src/core/memory/types.ts`

- [ ] **Step 1: Create the types file with all memory system interfaces**

```typescript
// src/core/memory/types.ts

export interface MemoryEntry {
	id: string
	workspaceId: string | null
	category: MemoryCategorySlug
	content: string
	significance: number
	firstSeen: number
	lastReinforced: number
	reinforcementCount: number
	decayRate: number
	sourceTaskId: string | null
	isPinned: boolean
}

export type MemoryCategorySlug =
	| "coding-style"
	| "communication-prefs"
	| "technical-proficiency"
	| "tool-preferences"
	| "active-projects"
	| "behavioral-patterns"
	| "dislikes-frustrations"

export interface MemoryCategory {
	slug: MemoryCategorySlug
	label: string
	defaultDecayRate: number
	priorityWeight: number
}

export const DEFAULT_MEMORY_CATEGORIES: MemoryCategory[] = [
	{ slug: "coding-style", label: "Coding Style", defaultDecayRate: 0.05, priorityWeight: 0.9 },
	{ slug: "communication-prefs", label: "Communication Preferences", defaultDecayRate: 0.05, priorityWeight: 0.95 },
	{ slug: "technical-proficiency", label: "Technical Proficiency", defaultDecayRate: 0.08, priorityWeight: 0.85 },
	{ slug: "tool-preferences", label: "Tool Preferences", defaultDecayRate: 0.12, priorityWeight: 0.7 },
	{ slug: "active-projects", label: "Active Projects", defaultDecayRate: 0.3, priorityWeight: 0.6 },
	{ slug: "behavioral-patterns", label: "Behavioral Patterns", defaultDecayRate: 0.15, priorityWeight: 0.75 },
	{ slug: "dislikes-frustrations", label: "Dislikes & Frustrations", defaultDecayRate: 0.08, priorityWeight: 0.9 },
]

export type ObservationAction = "NEW" | "REINFORCE" | "UPDATE"

export interface Observation {
	action: ObservationAction
	category: MemoryCategorySlug
	content: string
	significance: number
	existingEntryId: string | null
	reasoning: string
}

export interface AnalysisResult {
	observations: Observation[]
	sessionSummary: string
}

export interface AnalysisLogEntry {
	id: string
	timestamp: number
	taskId: string | null
	messagesAnalyzed: number
	tokensUsed: number
	entriesCreated: number
	entriesReinforced: number
}

export interface ScoredMemoryEntry extends MemoryEntry {
	computedScore: number
	categoryLabel: string
}

export interface PreprocessResult {
	cleaned: string
	originalTokenEstimate: number
	cleanedTokenEstimate: number
}

export const MEMORY_CONSTANTS = {
	MIN_CONTEXT_WINDOW: 50_000,
	DEFAULT_ANALYSIS_FREQUENCY: 8,
	MAX_ENTRIES: 500,
	SCORE_THRESHOLD: 0.05,
	GARBAGE_COLLECTION_SCORE_THRESHOLD: 0.01,
	GARBAGE_COLLECTION_DAYS: 90,
	PROMPT_TOKEN_CAP: 1500,
	MAX_QUERY_ENTRIES: 40,
	DEDUP_SIMILARITY_THRESHOLD: 0.6,
} as const
```

- [ ] **Step 2: Commit**

```bash
git add src/core/memory/types.ts
git commit -m "feat(memory): add types and interfaces for intelligent memory system"
```

---

## Task 2: Scoring Module

**Files:**
- Create: `src/core/memory/scoring.ts`
- Create: `src/core/memory/__tests__/scoring.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/core/memory/__tests__/scoring.spec.ts
import { computeScore, reinforcementBonus, temporalDecay } from "../scoring"

describe("reinforcementBonus", () => {
	it("should return ~1.0 for count of 1", () => {
		expect(reinforcementBonus(1)).toBeCloseTo(1.0, 1)
	})

	it("should increase with higher counts", () => {
		expect(reinforcementBonus(4)).toBeGreaterThan(reinforcementBonus(2))
	})

	it("should cap at 3.0", () => {
		expect(reinforcementBonus(100)).toBeLessThanOrEqual(3.0)
		expect(reinforcementBonus(1000)).toBeLessThanOrEqual(3.0)
	})
})

describe("temporalDecay", () => {
	it("should return 1.0 for 0 days", () => {
		expect(temporalDecay(0, 0.1)).toBeCloseTo(1.0)
	})

	it("should decrease over time", () => {
		expect(temporalDecay(30, 0.1)).toBeLessThan(temporalDecay(10, 0.1))
	})

	it("should decay faster with higher decay rate", () => {
		expect(temporalDecay(10, 0.3)).toBeLessThan(temporalDecay(10, 0.05))
	})

	it("should approach 0 for very old entries with high decay", () => {
		expect(temporalDecay(365, 0.3)).toBeLessThan(0.001)
	})
})

describe("computeScore", () => {
	it("should combine all factors", () => {
		const score = computeScore({
			significance: 0.8,
			priorityWeight: 0.9,
			reinforcementCount: 3,
			daysSinceReinforced: 5,
			decayRate: 0.05,
		})
		expect(score).toBeGreaterThan(0)
		expect(score).toBeLessThan(3) // bounded by reinforcement cap
	})

	it("should return 0 for zero significance", () => {
		const score = computeScore({
			significance: 0,
			priorityWeight: 0.9,
			reinforcementCount: 5,
			daysSinceReinforced: 1,
			decayRate: 0.05,
		})
		expect(score).toBe(0)
	})

	it("should return higher score for recently reinforced entry", () => {
		const recent = computeScore({
			significance: 0.8,
			priorityWeight: 0.9,
			reinforcementCount: 3,
			daysSinceReinforced: 1,
			decayRate: 0.1,
		})
		const old = computeScore({
			significance: 0.8,
			priorityWeight: 0.9,
			reinforcementCount: 3,
			daysSinceReinforced: 60,
			decayRate: 0.1,
		})
		expect(recent).toBeGreaterThan(old)
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src && npx vitest run core/memory/__tests__/scoring.spec.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement the scoring module**

```typescript
// src/core/memory/scoring.ts

export function reinforcementBonus(count: number): number {
	return Math.min(Math.log2(count + 1), 3.0)
}

export function temporalDecay(daysSinceReinforced: number, decayRate: number): number {
	return Math.exp(-decayRate * daysSinceReinforced)
}

export interface ScoreInput {
	significance: number
	priorityWeight: number
	reinforcementCount: number
	daysSinceReinforced: number
	decayRate: number
}

export function computeScore(input: ScoreInput): number {
	return (
		input.significance *
		input.priorityWeight *
		reinforcementBonus(input.reinforcementCount) *
		temporalDecay(input.daysSinceReinforced, input.decayRate)
	)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src && npx vitest run core/memory/__tests__/scoring.spec.ts`
Expected: PASS (all 9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/memory/scoring.ts src/core/memory/__tests__/scoring.spec.ts
git commit -m "feat(memory): add scoring module with decay and reinforcement formulas"
```

---

## Task 3: Message Preprocessor

**Files:**
- Create: `src/core/memory/preprocessor.ts`
- Create: `src/core/memory/__tests__/preprocessor.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/core/memory/__tests__/preprocessor.spec.ts
import { preprocessMessages } from "../preprocessor"
import type { ApiMessage } from "../types"

// Minimal ApiMessage mock shape matching Anthropic.MessageParam
const makeUserMsg = (text: string): any => ({
	role: "user" as const,
	content: [{ type: "text", text }],
})

const makeAssistantMsg = (content: any[]): any => ({
	role: "assistant" as const,
	content,
})

describe("preprocessMessages", () => {
	it("should keep user message text fully", () => {
		const result = preprocessMessages([makeUserMsg("I prefer TypeScript")])
		expect(result.cleaned).toContain("I prefer TypeScript")
	})

	it("should keep assistant text blocks", () => {
		const msg = makeAssistantMsg([
			{ type: "text", text: "I'll update the auth component." },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("I'll update the auth component.")
	})

	it("should replace read_file tool_use with filename only", () => {
		const msg = makeAssistantMsg([
			{ type: "text", text: "Let me check that file." },
			{ type: "tool_use", id: "1", name: "read_file", input: { path: "src/auth/Auth.tsx" } },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("→ read: src/auth/Auth.tsx")
		expect(result.cleaned).not.toContain("tool_use")
	})

	it("should replace execute_command with command only", () => {
		const msg = makeAssistantMsg([
			{ type: "tool_use", id: "2", name: "execute_command", input: { command: "npm test" } },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("→ ran command: npm test")
	})

	it("should strip tool_result blocks entirely", () => {
		const msg = makeAssistantMsg([
			{ type: "tool_result", tool_use_id: "1", content: "200 lines of code..." },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).not.toContain("200 lines of code")
	})

	it("should strip base64 image data from user messages", () => {
		const msg: any = {
			role: "user" as const,
			content: [
				{ type: "image", source: { type: "base64", data: "abc123longdata..." } },
				{ type: "text", text: "What does this show?" },
			],
		}
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("[image attached]")
		expect(result.cleaned).toContain("What does this show?")
		expect(result.cleaned).not.toContain("abc123longdata")
	})

	it("should strip code blocks longer than 3 lines from assistant messages", () => {
		const msg = makeAssistantMsg([
			{
				type: "text",
				text: "Here's the code:\n```typescript\nline1\nline2\nline3\nline4\n```\nDone.",
			},
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("Here's the code:")
		expect(result.cleaned).toContain("Done.")
		expect(result.cleaned).not.toContain("line4")
	})

	it("should keep short code blocks (≤3 lines)", () => {
		const msg = makeAssistantMsg([
			{ type: "text", text: "Try: ```const x = 1``` like that." },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("const x = 1")
	})

	it("should return token estimates", () => {
		const result = preprocessMessages([
			makeUserMsg("hello"),
			makeAssistantMsg([{ type: "text", text: "hi there" }]),
		])
		expect(result.originalTokenEstimate).toBeGreaterThan(0)
		expect(result.cleanedTokenEstimate).toBeGreaterThan(0)
		expect(result.cleanedTokenEstimate).toBeLessThanOrEqual(result.originalTokenEstimate)
	})

	it("should handle empty message array", () => {
		const result = preprocessMessages([])
		expect(result.cleaned).toBe("")
		expect(result.cleanedTokenEstimate).toBe(0)
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src && npx vitest run core/memory/__tests__/preprocessor.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the preprocessor**

```typescript
// src/core/memory/preprocessor.ts
import type { PreprocessResult } from "./types"

// Tool names that produce filename references
const FILE_TOOLS = new Set(["read_file", "write_to_file", "apply_diff"])
const SEARCH_TOOLS = new Set(["search_files", "list_files"])

// Estimate tokens as ~4 chars per token (rough, fast)
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4)
}

function stripLongCodeBlocks(text: string): string {
	return text.replace(/```[\s\S]*?```/g, (match) => {
		const lines = match.split("\n")
		// Opening ``` + content lines + closing ```
		// Content lines = total - 2 (opening and closing ```)
		if (lines.length - 2 > 3) {
			return "[code block removed]"
		}
		return match
	})
}

function processUserContent(content: any): string {
	if (typeof content === "string") return content

	if (!Array.isArray(content)) return ""

	const parts: string[] = []
	for (const block of content) {
		if (block.type === "text") {
			parts.push(block.text)
		} else if (block.type === "image" || block.type === "image_url") {
			parts.push("[image attached]")
		}
	}
	return parts.join("\n")
}

function processAssistantContent(content: any): string {
	if (typeof content === "string") return stripLongCodeBlocks(content)

	if (!Array.isArray(content)) return ""

	const parts: string[] = []
	for (const block of content) {
		if (block.type === "text") {
			parts.push(stripLongCodeBlocks(block.text))
		} else if (block.type === "tool_use") {
			const name = block.name
			const input = block.input || {}
			if (FILE_TOOLS.has(name)) {
				parts.push(`→ ${name === "read_file" ? "read" : "edited"}: ${input.path || "unknown"}`)
			} else if (name === "execute_command") {
				parts.push(`→ ran command: ${input.command || "unknown"}`)
			} else if (SEARCH_TOOLS.has(name)) {
				parts.push(`→ searched: ${input.path || input.regex || "unknown"}`)
			}
			// All other tool_use blocks are stripped (no output)
		}
		// tool_result blocks are stripped entirely (no case for them)
	}
	return parts.join("\n")
}

export function preprocessMessages(messages: any[]): PreprocessResult {
	if (messages.length === 0) {
		return { cleaned: "", originalTokenEstimate: 0, cleanedTokenEstimate: 0 }
	}

	let originalText = ""
	const cleanedParts: string[] = []

	for (const msg of messages) {
		const role = msg.role
		const rawContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
		originalText += rawContent

		if (role === "user") {
			const processed = processUserContent(msg.content)
			if (processed.trim()) {
				cleanedParts.push(`User: ${processed.trim()}`)
			}
		} else if (role === "assistant") {
			const processed = processAssistantContent(msg.content)
			if (processed.trim()) {
				cleanedParts.push(`Assistant: ${processed.trim()}`)
			}
		}
	}

	const cleaned = cleanedParts.join("\n\n")
	return {
		cleaned,
		originalTokenEstimate: estimateTokens(originalText),
		cleanedTokenEstimate: estimateTokens(cleaned),
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src && npx vitest run core/memory/__tests__/preprocessor.spec.ts`
Expected: PASS (all 9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/memory/preprocessor.ts src/core/memory/__tests__/preprocessor.spec.ts
git commit -m "feat(memory): add message preprocessor with noise filtering"
```

---

## Task 4: Memory Store (SQLite via sql.js)

**Files:**
- Create: `src/core/memory/memory-store.ts`
- Modify: `package.json` (root, add sql.js)

- [ ] **Step 1: Install sql.js dependency**

Run: `pnpm add sql.js` (from workspace root, installs to the monorepo)

Check that `sql.js` appears in dependencies. Also verify that `sql-wasm.wasm` file exists in `node_modules/sql.js/dist/`.

- [ ] **Step 2: Implement the memory store**

```typescript
// src/core/memory/memory-store.ts
import initSqlJs, { type Database } from "sql.js"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import type { MemoryEntry, MemoryCategory, AnalysisLogEntry, ScoredMemoryEntry, MemoryCategorySlug } from "./types"
import { DEFAULT_MEMORY_CATEGORIES, MEMORY_CONSTANTS } from "./types"
import { computeScore } from "./scoring"

const SCHEMA_VERSION = 1

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_categories (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  default_decay_rate REAL NOT NULL,
  priority_weight REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  category TEXT NOT NULL REFERENCES memory_categories(slug),
  content TEXT NOT NULL,
  significance REAL NOT NULL,
  first_seen INTEGER NOT NULL,
  last_reinforced INTEGER NOT NULL,
  reinforcement_count INTEGER DEFAULT 1,
  decay_rate REAL NOT NULL,
  source_task_id TEXT,
  is_pinned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analysis_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  task_id TEXT,
  messages_analyzed INTEGER NOT NULL,
  tokens_used INTEGER NOT NULL,
  entries_created INTEGER NOT NULL,
  entries_reinforced INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_category ON memory_entries(category);
CREATE INDEX IF NOT EXISTS idx_entries_workspace ON memory_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entries_last_reinforced ON memory_entries(last_reinforced);
`

export class MemoryStore {
	private db: Database | null = null
	private dbPath: string

	constructor(storagePath: string) {
		const memoryDir = path.join(storagePath, "memory")
		if (!fs.existsSync(memoryDir)) {
			fs.mkdirSync(memoryDir, { recursive: true })
		}
		this.dbPath = path.join(memoryDir, "user_memory.db")
	}

	async init(): Promise<void> {
		const SQL = await initSqlJs()

		if (fs.existsSync(this.dbPath)) {
			const fileBuffer = fs.readFileSync(this.dbPath)
			this.db = new SQL.Database(fileBuffer)
		} else {
			this.db = new SQL.Database()
		}

		this.db.run(SCHEMA_SQL)
		this.initSchemaVersion()
		this.seedCategories()
		this.persist()
	}

	private initSchemaVersion(): void {
		const result = this.db!.exec("SELECT value FROM schema_meta WHERE key = 'version'")
		if (result.length === 0 || result[0].values.length === 0) {
			this.db!.run("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', ?)", [
				String(SCHEMA_VERSION),
			])
		} else {
			const currentVersion = parseInt(result[0].values[0][0] as string, 10)
			this.runMigrations(currentVersion)
		}
	}

	private runMigrations(fromVersion: number): void {
		// Future migrations go here as: if (fromVersion < 2) { ... }
		// After all migrations, update version:
		if (fromVersion < SCHEMA_VERSION) {
			this.db!.run("UPDATE schema_meta SET value = ? WHERE key = 'version'", [
				String(SCHEMA_VERSION),
			])
		}
	}

	private seedCategories(): void {
		const stmt = this.db!.prepare("INSERT OR IGNORE INTO memory_categories (slug, label, default_decay_rate, priority_weight) VALUES (?, ?, ?, ?)")
		for (const cat of DEFAULT_MEMORY_CATEGORIES) {
			stmt.run([cat.slug, cat.label, cat.defaultDecayRate, cat.priorityWeight])
		}
		stmt.free()
	}

	private persist(): void {
		if (!this.db) return
		const data = this.db.export()
		const buffer = Buffer.from(data)
		const tmpPath = this.dbPath + ".tmp"
		fs.writeFileSync(tmpPath, buffer)
		fs.renameSync(tmpPath, this.dbPath)
	}

	generateId(): string {
		return crypto.randomUUID()
	}

	insertEntry(entry: Omit<MemoryEntry, "id"> & { id?: string }): string {
		const id = entry.id || this.generateId()
		this.db!.run(
			`INSERT INTO memory_entries (id, workspace_id, category, content, significance, first_seen, last_reinforced, reinforcement_count, decay_rate, source_task_id, is_pinned)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[id, entry.workspaceId, entry.category, entry.content, entry.significance, entry.firstSeen, entry.lastReinforced, entry.reinforcementCount, entry.decayRate, entry.sourceTaskId, entry.isPinned ? 1 : 0],
		)
		this.persist()
		return id
	}

	reinforceEntry(id: string, taskId: string | null): void {
		this.db!.run(
			`UPDATE memory_entries SET last_reinforced = ?, reinforcement_count = reinforcement_count + 1, source_task_id = ? WHERE id = ?`,
			[Math.floor(Date.now() / 1000), taskId, id],
		)
		this.persist()
	}

	updateEntry(id: string, content: string, significance: number, taskId: string | null): void {
		this.db!.run(
			`UPDATE memory_entries SET content = ?, significance = ?, last_reinforced = ?, reinforcement_count = reinforcement_count + 1, source_task_id = ? WHERE id = ?`,
			[content, significance, Math.floor(Date.now() / 1000), taskId, id],
		)
		this.persist()
	}

	getEntry(id: string): MemoryEntry | null {
		const result = this.db!.exec("SELECT * FROM memory_entries WHERE id = ?", [id])
		if (result.length === 0 || result[0].values.length === 0) return null
		return this.rowToEntry(result[0].columns, result[0].values[0])
	}

	getEntriesByCategory(category: string, workspaceId: string | null): MemoryEntry[] {
		const result = this.db!.exec(
			"SELECT * FROM memory_entries WHERE category = ? AND (workspace_id IS NULL OR workspace_id = ?) ORDER BY last_reinforced DESC",
			[category, workspaceId],
		)
		if (result.length === 0) return []
		return result[0].values.map((row) => this.rowToEntry(result[0].columns, row))
	}

	getScoredEntries(workspaceId: string | null): ScoredMemoryEntry[] {
		const result = this.db!.exec(
			`SELECT e.*, c.priority_weight, c.label as category_label
			 FROM memory_entries e
			 JOIN memory_categories c ON e.category = c.slug
			 WHERE (e.workspace_id IS NULL OR e.workspace_id = ?)
			 ORDER BY e.last_reinforced DESC`,
			[workspaceId],
		)

		if (result.length === 0) return []

		const now = Math.floor(Date.now() / 1000)
		const entries: ScoredMemoryEntry[] = []

		for (const row of result[0].values) {
			const cols = result[0].columns
			const entry = this.rowToEntry(cols, row)
			const priorityWeight = row[cols.indexOf("priority_weight")] as number
			const categoryLabel = row[cols.indexOf("category_label")] as string
			const daysSinceReinforced = (now - entry.lastReinforced) / 86400

			const score = computeScore({
				significance: entry.significance,
				priorityWeight,
				reinforcementCount: entry.reinforcementCount,
				daysSinceReinforced,
				decayRate: entry.decayRate,
			})

			if (score >= MEMORY_CONSTANTS.SCORE_THRESHOLD) {
				entries.push({ ...entry, computedScore: score, categoryLabel })
			}
		}

		entries.sort((a, b) => b.computedScore - a.computedScore)
		return entries.slice(0, MEMORY_CONSTANTS.MAX_QUERY_ENTRIES)
	}

	logAnalysis(entry: AnalysisLogEntry): void {
		this.db!.run(
			`INSERT INTO analysis_log (id, timestamp, task_id, messages_analyzed, tokens_used, entries_created, entries_reinforced)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[entry.id, entry.timestamp, entry.taskId, entry.messagesAnalyzed, entry.tokensUsed, entry.entriesCreated, entry.entriesReinforced],
		)
		this.persist()
	}

	garbageCollect(): number {
		const now = Math.floor(Date.now() / 1000)
		const cutoff = now - MEMORY_CONSTANTS.GARBAGE_COLLECTION_DAYS * 86400

		// Delete entries that are old, low-scored, and not pinned
		// We compute score in JS since sql.js doesn't have LOG2/EXP natively
		const result = this.db!.exec(
			`SELECT e.id, e.significance, e.reinforcement_count, e.last_reinforced, e.decay_rate, e.is_pinned, c.priority_weight
			 FROM memory_entries e
			 JOIN memory_categories c ON e.category = c.slug
			 WHERE e.is_pinned = 0 AND e.last_reinforced < ?`,
			[cutoff],
		)

		if (result.length === 0) return 0

		const toDelete: string[] = []
		for (const row of result[0].values) {
			const cols = result[0].columns
			const significance = row[cols.indexOf("significance")] as number
			const count = row[cols.indexOf("reinforcement_count")] as number
			const lastReinforced = row[cols.indexOf("last_reinforced")] as number
			const decayRate = row[cols.indexOf("decay_rate")] as number
			const priorityWeight = row[cols.indexOf("priority_weight")] as number

			const score = computeScore({
				significance,
				priorityWeight,
				reinforcementCount: count,
				daysSinceReinforced: (now - lastReinforced) / 86400,
				decayRate,
			})

			if (score < MEMORY_CONSTANTS.GARBAGE_COLLECTION_SCORE_THRESHOLD) {
				toDelete.push(row[cols.indexOf("id")] as string)
			}
		}

		for (const id of toDelete) {
			this.db!.run("DELETE FROM memory_entries WHERE id = ?", [id])
		}

		// Hard cap enforcement
		const countResult = this.db!.exec("SELECT COUNT(*) FROM memory_entries")
		const totalCount = countResult[0].values[0][0] as number
		if (totalCount > MEMORY_CONSTANTS.MAX_ENTRIES) {
			// Get all entries scored, delete lowest until under cap
			const allScored = this.getScoredEntries(null)
			// getScoredEntries already limits to 40, so query all here
			const allResult = this.db!.exec(
				`SELECT e.id, e.significance, e.reinforcement_count, e.last_reinforced, e.decay_rate, e.is_pinned, c.priority_weight
				 FROM memory_entries e
				 JOIN memory_categories c ON e.category = c.slug
				 WHERE e.is_pinned = 0
				 ORDER BY e.last_reinforced ASC`,
			)
			if (allResult.length > 0) {
				const excess = totalCount - MEMORY_CONSTANTS.MAX_ENTRIES
				const scored = allResult[0].values.map((row) => {
					const cols = allResult[0].columns
					return {
						id: row[cols.indexOf("id")] as string,
						score: computeScore({
							significance: row[cols.indexOf("significance")] as number,
							priorityWeight: row[cols.indexOf("priority_weight")] as number,
							reinforcementCount: row[cols.indexOf("reinforcement_count")] as number,
							daysSinceReinforced: (now - (row[cols.indexOf("last_reinforced")] as number)) / 86400,
							decayRate: row[cols.indexOf("decay_rate")] as number,
						}),
					}
				}).sort((a, b) => a.score - b.score)

				for (let i = 0; i < Math.min(excess, scored.length); i++) {
					this.db!.run("DELETE FROM memory_entries WHERE id = ?", [scored[i].id])
					toDelete.push(scored[i].id)
				}
			}
		}

		if (toDelete.length > 0) this.persist()
		return toDelete.length
	}

	getEntryCount(): number {
		const result = this.db!.exec("SELECT COUNT(*) FROM memory_entries")
		return result[0].values[0][0] as number
	}

	close(): void {
		if (this.db) {
			this.db.close()
			this.db = null
		}
	}

	private rowToEntry(columns: string[], row: any[]): MemoryEntry {
		const get = (col: string) => row[columns.indexOf(col)]
		return {
			id: get("id") as string,
			workspaceId: get("workspace_id") as string | null,
			category: get("category") as MemoryCategorySlug,
			content: get("content") as string,
			significance: get("significance") as number,
			firstSeen: get("first_seen") as number,
			lastReinforced: get("last_reinforced") as number,
			reinforcementCount: get("reinforcement_count") as number,
			decayRate: get("decay_rate") as number,
			sourceTaskId: get("source_task_id") as string | null,
			isPinned: (get("is_pinned") as number) === 1,
		}
	}
}
```

- [ ] **Step 3: Run a quick smoke test manually**

Run: `cd src && npx vitest run core/memory/__tests__/scoring.spec.ts`
Expected: Still PASS (no regressions from new file)

- [ ] **Step 4: Commit**

```bash
git add src/core/memory/memory-store.ts package.json pnpm-lock.yaml
git commit -m "feat(memory): add SQLite memory store via sql.js with schema versioning"
```

---

## Task 5: Memory Writer (with PII filter and dedup)

**Files:**
- Create: `src/core/memory/memory-writer.ts`
- Create: `src/core/memory/__tests__/memory-writer.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/core/memory/__tests__/memory-writer.spec.ts
import { containsPII, jaccardSimilarity } from "../memory-writer"

describe("containsPII", () => {
	it("should detect email addresses", () => {
		expect(containsPII("User email is john@example.com")).toBe(true)
	})

	it("should detect OpenAI API keys", () => {
		expect(containsPII("Uses key sk-abcdefghijklmnopqrstuvwxyz1234")).toBe(true)
	})

	it("should detect GitHub PATs", () => {
		expect(containsPII("Token ghp_abcdefghijklmnopqrstuvwxyz1234567890")).toBe(true)
	})

	it("should not flag normal coding preferences", () => {
		expect(containsPII("Prefers TypeScript over JavaScript")).toBe(false)
	})

	it("should not flag file paths", () => {
		expect(containsPII("Frequently edits src/auth/login.ts")).toBe(false)
	})
})

describe("jaccardSimilarity", () => {
	it("should return 1.0 for identical strings", () => {
		expect(jaccardSimilarity("prefers typescript", "prefers typescript")).toBeCloseTo(1.0)
	})

	it("should return 0.0 for completely different strings", () => {
		expect(jaccardSimilarity("cats dogs birds", "alpha beta gamma")).toBeCloseTo(0.0)
	})

	it("should return high similarity for near-duplicates", () => {
		const sim = jaccardSimilarity(
			"Prefers functional React components",
			"Prefers functional React component patterns",
		)
		expect(sim).toBeGreaterThan(0.5)
	})

	it("should ignore short words (≤2 chars)", () => {
		const sim = jaccardSimilarity("I am a good coder", "I am a bad coder")
		// "I", "am", "a" are filtered, so it's {good, coder} vs {bad, coder}
		expect(sim).toBeLessThan(1.0)
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src && npx vitest run core/memory/__tests__/memory-writer.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the memory writer**

```typescript
// src/core/memory/memory-writer.ts
import type { Observation, MemoryCategorySlug } from "./types"
import { MEMORY_CONSTANTS, DEFAULT_MEMORY_CATEGORIES } from "./types"
import type { MemoryStore } from "./memory-store"

const PII_PATTERNS = [
	/\S+@\S+\.\S+/,
	/sk-[a-zA-Z0-9]{20,}/,
	/ghp_[a-zA-Z0-9]{36}/,
	/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
	/\b\d{3}-\d{2}-\d{4}\b/,
	/AKIA[0-9A-Z]{16}/,
	/-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
]

export function containsPII(content: string): boolean {
	return PII_PATTERNS.some((pattern) => pattern.test(content))
}

export function jaccardSimilarity(a: string, b: string): number {
	const tokenize = (s: string) =>
		new Set(
			s
				.toLowerCase()
				.split(/\s+/)
				.filter((w) => w.length > 2),
		)
	const setA = tokenize(a)
	const setB = tokenize(b)
	if (setA.size === 0 && setB.size === 0) return 1.0
	if (setA.size === 0 || setB.size === 0) return 0.0
	const intersection = new Set([...setA].filter((x) => setB.has(x)))
	const union = new Set([...setA, ...setB])
	return intersection.size / union.size
}

// Categories that are always global
const GLOBAL_CATEGORIES = new Set<MemoryCategorySlug>([
	"coding-style",
	"communication-prefs",
	"dislikes-frustrations",
])

// Categories that are always workspace-scoped
const WORKSPACE_CATEGORIES = new Set<MemoryCategorySlug>(["active-projects"])

function getDecayRate(category: MemoryCategorySlug): number {
	const cat = DEFAULT_MEMORY_CATEGORIES.find((c) => c.slug === category)
	return cat?.defaultDecayRate ?? 0.1
}

export interface WriteResult {
	entriesCreated: number
	entriesReinforced: number
	entriesSkipped: number
}

export function processObservations(
	store: MemoryStore,
	observations: Observation[],
	workspaceId: string | null,
	taskId: string | null,
): WriteResult {
	let created = 0
	let reinforced = 0
	let skipped = 0
	const now = Math.floor(Date.now() / 1000)

	for (const obs of observations) {
		// PII filter
		if (containsPII(obs.content)) {
			skipped++
			continue
		}

		if (obs.action === "NEW") {
			// Determine scope
			let entryWorkspaceId: string | null = null
			if (WORKSPACE_CATEGORIES.has(obs.category)) {
				entryWorkspaceId = workspaceId
			} else if (!GLOBAL_CATEGORIES.has(obs.category)) {
				// Heuristic: if content mentions paths, it's workspace-scoped
				entryWorkspaceId = /[/\\]/.test(obs.content) ? workspaceId : null
			}

			// Dedup check
			const existing = store.getEntriesByCategory(obs.category, entryWorkspaceId)
			const duplicate = existing.find(
				(e) => jaccardSimilarity(e.content, obs.content) >= MEMORY_CONSTANTS.DEDUP_SIMILARITY_THRESHOLD,
			)

			if (duplicate) {
				store.reinforceEntry(duplicate.id, taskId)
				reinforced++
			} else {
				store.insertEntry({
					workspaceId: entryWorkspaceId,
					category: obs.category,
					content: obs.content,
					significance: obs.significance,
					firstSeen: now,
					lastReinforced: now,
					reinforcementCount: 1,
					decayRate: getDecayRate(obs.category),
					sourceTaskId: taskId,
					isPinned: false,
				})
				created++
			}
		} else if (obs.action === "REINFORCE") {
			if (obs.existingEntryId) {
				const entry = store.getEntry(obs.existingEntryId)
				if (entry && entry.category === obs.category) {
					store.reinforceEntry(obs.existingEntryId, taskId)
					reinforced++
				} else {
					skipped++ // Invalid ID — skip silently
				}
			} else {
				skipped++
			}
		} else if (obs.action === "UPDATE") {
			if (obs.existingEntryId) {
				const entry = store.getEntry(obs.existingEntryId)
				if (entry && entry.category === obs.category) {
					store.updateEntry(obs.existingEntryId, obs.content, obs.significance, taskId)
					reinforced++
				} else {
					// Invalid ID — treat as NEW with dedup check
					const existing = store.getEntriesByCategory(obs.category, workspaceId)
					const duplicate = existing.find(
						(e) => jaccardSimilarity(e.content, obs.content) >= MEMORY_CONSTANTS.DEDUP_SIMILARITY_THRESHOLD,
					)
					if (duplicate) {
						store.updateEntry(duplicate.id, obs.content, obs.significance, taskId)
						reinforced++
					} else {
						store.insertEntry({
							workspaceId: WORKSPACE_CATEGORIES.has(obs.category) ? workspaceId : null,
							category: obs.category,
							content: obs.content,
							significance: obs.significance,
							firstSeen: now,
							lastReinforced: now,
							reinforcementCount: 1,
							decayRate: getDecayRate(obs.category),
							sourceTaskId: taskId,
							isPinned: false,
						})
						created++
					}
				}
			} else {
				skipped++
			}
		}
	}

	return { entriesCreated: created, entriesReinforced: reinforced, entriesSkipped: skipped }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src && npx vitest run core/memory/__tests__/memory-writer.spec.ts`
Expected: PASS (all 10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/memory/memory-writer.ts src/core/memory/__tests__/memory-writer.spec.ts
git commit -m "feat(memory): add memory writer with PII filter, dedup, and workspace scoping"
```

---

## Task 6: Prompt Compiler

**Files:**
- Create: `src/core/memory/prompt-compiler.ts`
- Create: `src/core/memory/__tests__/prompt-compiler.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/core/memory/__tests__/prompt-compiler.spec.ts
import { compileMemoryPrompt, compileMemoryForAgent } from "../prompt-compiler"
import type { ScoredMemoryEntry } from "../types"

const makeScoredEntry = (
	category: string,
	content: string,
	score: number,
	label: string = "Test",
): ScoredMemoryEntry => ({
	id: `test-${Math.random().toString(36).slice(2)}`,
	workspaceId: null,
	category: category as any,
	content,
	significance: 0.8,
	firstSeen: 1000,
	lastReinforced: 2000,
	reinforcementCount: 3,
	decayRate: 0.05,
	sourceTaskId: null,
	isPinned: false,
	computedScore: score,
	categoryLabel: label,
})

describe("compileMemoryPrompt", () => {
	it("should return empty string for no entries", () => {
		expect(compileMemoryPrompt([])).toBe("")
	})

	it("should include USER PROFILE header", () => {
		const entries = [makeScoredEntry("coding-style", "Prefers TypeScript", 0.9, "Coding Style")]
		const result = compileMemoryPrompt(entries)
		expect(result).toContain("USER PROFILE & PREFERENCES")
	})

	it("should group entries by category", () => {
		const entries = [
			makeScoredEntry("coding-style", "Prefers TypeScript", 0.9, "Coding Style"),
			makeScoredEntry("coding-style", "Uses React hooks", 0.8, "Coding Style"),
			makeScoredEntry("communication-prefs", "Likes concise responses", 0.85, "Communication Preferences"),
		]
		const result = compileMemoryPrompt(entries)
		expect(result).toContain("Coding Style:")
		expect(result).toContain("Communication Preferences:")
	})

	it("should omit empty categories", () => {
		const entries = [makeScoredEntry("coding-style", "Prefers TypeScript", 0.9, "Coding Style")]
		const result = compileMemoryPrompt(entries)
		expect(result).not.toContain("Communication Preferences:")
	})
})

describe("compileMemoryForAgent", () => {
	it("should include entry IDs", () => {
		const entry = makeScoredEntry("coding-style", "Prefers TypeScript", 0.9, "Coding Style")
		const result = compileMemoryForAgent([entry])
		expect(result).toContain(entry.id)
	})

	it("should include scores", () => {
		const entries = [makeScoredEntry("coding-style", "Prefers TS", 0.87, "Coding Style")]
		const result = compileMemoryForAgent(entries)
		expect(result).toContain("0.87")
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src && npx vitest run core/memory/__tests__/prompt-compiler.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement the prompt compiler**

```typescript
// src/core/memory/prompt-compiler.ts
import type { ScoredMemoryEntry } from "./types"
import { MEMORY_CONSTANTS } from "./types"

// Rough token estimate
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4)
}

export function compileMemoryPrompt(entries: ScoredMemoryEntry[]): string {
	if (entries.length === 0) return ""

	// Group by category label
	const groups = new Map<string, string[]>()
	for (const entry of entries) {
		if (!groups.has(entry.categoryLabel)) {
			groups.set(entry.categoryLabel, [])
		}
		groups.get(entry.categoryLabel)!.push(entry.content)
	}

	// Build prose sections
	const sections: string[] = []
	for (const [label, contents] of groups) {
		sections.push(`${label}: ${contents.join(". ")}.`)
	}

	let prose = sections.join("\n\n")

	// Token cap — drop from the end (lowest priority sections) until within budget
	while (estimateTokens(prose) > MEMORY_CONSTANTS.PROMPT_TOKEN_CAP && sections.length > 1) {
		sections.pop()
		prose = sections.join("\n\n")
	}

	return `USER PROFILE & PREFERENCES\n(Learned through conversation — continuously updated)\n\n${prose}`
}

export function compileMemoryForAgent(entries: ScoredMemoryEntry[]): string {
	if (entries.length === 0) return "No existing memory entries."

	return entries
		.map(
			(e) =>
				`[${e.id}] ${e.category} (score: ${e.computedScore.toFixed(2)}): ${e.content}`,
		)
		.join("\n")
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src && npx vitest run core/memory/__tests__/prompt-compiler.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/memory/prompt-compiler.ts src/core/memory/__tests__/prompt-compiler.spec.ts
git commit -m "feat(memory): add prompt compiler for system prompt and analysis agent rendering"
```

---

## Task 7: Analysis Agent

**Files:**
- Create: `src/core/memory/analysis-agent.ts`

- [ ] **Step 1: Implement the analysis agent**

This module calls the LLM. It uses the existing `buildApiHandler()` and `SingleCompletionHandler` patterns from `src/api/index.ts`.

```typescript
// src/core/memory/analysis-agent.ts
import type { AnalysisResult, Observation, MemoryCategorySlug } from "./types"
import { buildApiHandler, type SingleCompletionHandler } from "../../api"
import type { ProviderSettings } from "@roo-code/types"

const VALID_CATEGORIES = new Set<string>([
	"coding-style", "communication-prefs", "technical-proficiency",
	"tool-preferences", "active-projects", "behavioral-patterns", "dislikes-frustrations",
])

const VALID_ACTIONS = new Set<string>(["NEW", "REINFORCE", "UPDATE"])

const ANALYSIS_SYSTEM_PROMPT = `You are a User Profile Analyst. Your job is to extract factual observations about the USER from conversation transcripts between them and a coding assistant.

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
- If an observation matches something in the existing memory, mark it as REINFORCE (don't create a duplicate).
- If an observation contradicts existing memory, mark it as UPDATE with the new value.
- If it's completely new, mark it as NEW.
- Write each observation as a concise, third-person factual statement (e.g., "Prefers functional React components over class components")
- Assign significance 0.0-1.0 based on how broadly useful this fact is for future interactions.

PRIVACY — NEVER extract:
- Real names, emails, addresses, phone numbers
- API keys, passwords, secrets, tokens
- Company confidential or proprietary details
- Health, financial, legal, or relationship information
- Anything the user explicitly marks as private or off-record

If the conversation contains mostly one-liners or nothing personality-revealing, return an empty observations array. Don't force extraction.

Respond in this exact JSON format (no markdown fences, just raw JSON):
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
}`

export async function runAnalysis(
	providerSettings: ProviderSettings,
	cleanedConversation: string,
	existingMemoryReport: string,
): Promise<AnalysisResult | null> {
	try {
		const handler = buildApiHandler(providerSettings)

		// Check if handler supports single completion
		if (!("completePrompt" in handler)) {
			console.error("[MemoryAgent] Handler does not support completePrompt")
			return null
		}

		const prompt = `EXISTING MEMORY:\n${existingMemoryReport}\n\n---\n\nCONVERSATION TRANSCRIPT:\n${cleanedConversation}`

		const response = await (handler as unknown as SingleCompletionHandler).completePrompt(
			`${ANALYSIS_SYSTEM_PROMPT}\n\n${prompt}`,
		)

		return parseAnalysisResponse(response)
	} catch (error) {
		console.error("[MemoryAgent] Analysis failed:", error)
		return null
	}
}

function parseAnalysisResponse(response: string): AnalysisResult | null {
	try {
		// Strip markdown code fences if present
		const cleaned = response.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim()
		const parsed = JSON.parse(cleaned)

		if (!parsed.observations || !Array.isArray(parsed.observations)) {
			return { observations: [], sessionSummary: parsed.session_summary || "" }
		}

		// Validate and filter observations
		const validObservations: Observation[] = parsed.observations
			.filter((obs: any) => {
				return (
					VALID_ACTIONS.has(obs.action) &&
					VALID_CATEGORIES.has(obs.category) &&
					typeof obs.content === "string" &&
					obs.content.length > 0 &&
					typeof obs.significance === "number" &&
					obs.significance >= 0 &&
					obs.significance <= 1
				)
			})
			.map((obs: any) => ({
				action: obs.action,
				category: obs.category as MemoryCategorySlug,
				content: obs.content,
				significance: obs.significance,
				existingEntryId: obs.existing_entry_id || null,
				reasoning: obs.reasoning || "",
			}))

		return {
			observations: validObservations,
			sessionSummary: parsed.session_summary || "",
		}
	} catch (error) {
		console.error("[MemoryAgent] Failed to parse response:", error)
		return null
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/memory/analysis-agent.ts
git commit -m "feat(memory): add analysis agent with LLM invocation and response parsing"
```

---

## Task 8: Pipeline Orchestrator

**Files:**
- Create: `src/core/memory/orchestrator.ts`

- [ ] **Step 1: Implement the orchestrator**

```typescript
// src/core/memory/orchestrator.ts
import * as crypto from "crypto"
import * as path from "path"
import { execSync } from "child_process"
import type { ProviderSettings } from "@roo-code/types"
import { MemoryStore } from "./memory-store"
import { preprocessMessages } from "./preprocessor"
import { runAnalysis } from "./analysis-agent"
import { processObservations } from "./memory-writer"
import { compileMemoryPrompt, compileMemoryForAgent } from "./prompt-compiler"
import { MEMORY_CONSTANTS } from "./types"

function getWorkspaceId(workspacePath: string): string {
	const folderName = path.basename(workspacePath)
	let gitRemote: string | null = null
	try {
		gitRemote = execSync("git remote get-url origin", {
			cwd: workspacePath,
			encoding: "utf-8",
			timeout: 3000,
		}).trim()
	} catch {
		// Not a git repo or no remote
	}
	const raw = gitRemote ? `${gitRemote}::${folderName}` : folderName
	return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)
}

export class MemoryOrchestrator {
	private store: MemoryStore
	private messageCounter = 0
	private watermark = 0
	private analysisInFlight = false
	private analysisQueued = false
	private enabled = false
	private workspaceId: string | null = null
	private analysisFrequency: number

	constructor(
		private storagePath: string,
		private workspacePath: string | null,
		analysisFrequency?: number,
	) {
		this.store = new MemoryStore(storagePath)
		this.analysisFrequency = analysisFrequency || MEMORY_CONSTANTS.DEFAULT_ANALYSIS_FREQUENCY
		if (workspacePath) {
			this.workspaceId = getWorkspaceId(workspacePath)
		}
	}

	async init(): Promise<void> {
		await this.store.init()
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled
		if (!enabled) {
			this.messageCounter = 0
		}
	}

	isEnabled(): boolean {
		return this.enabled
	}

	/**
	 * Call this on each user message during an active chat session.
	 * Returns true if an analysis cycle was triggered.
	 */
	onUserMessage(
		messages: any[],
		taskId: string | null,
		providerSettings: ProviderSettings | null,
	): boolean {
		if (!this.enabled || !providerSettings) return false

		this.messageCounter++

		if (this.messageCounter >= this.analysisFrequency) {
			this.triggerAnalysis(messages, taskId, providerSettings)
			this.messageCounter = 0
			return true
		}

		return false
	}

	/**
	 * Call on session end to catch remaining unanalyzed messages.
	 */
	onSessionEnd(
		messages: any[],
		taskId: string | null,
		providerSettings: ProviderSettings | null,
	): void {
		if (!this.enabled || !providerSettings) return
		if (this.watermark < messages.length) {
			this.triggerAnalysis(messages, taskId, providerSettings)
		}
	}

	private async triggerAnalysis(
		messages: any[],
		taskId: string | null,
		providerSettings: ProviderSettings,
	): Promise<void> {
		if (this.analysisInFlight) {
			this.analysisQueued = true
			return
		}

		this.analysisInFlight = true

		try {
			// Grab messages since last watermark
			const batch = messages.slice(this.watermark)
			this.watermark = messages.length

			if (batch.length === 0) return

			// Preprocess
			const preprocessed = preprocessMessages(batch)
			if (preprocessed.cleaned.trim().length === 0) return

			// Get existing memory for context
			const scoredEntries = this.store.getScoredEntries(this.workspaceId)
			const existingReport = compileMemoryForAgent(scoredEntries)

			// Run analysis
			const result = await runAnalysis(providerSettings, preprocessed.cleaned, existingReport)

			if (result && result.observations.length > 0) {
				const writeResult = processObservations(
					this.store,
					result.observations,
					this.workspaceId,
					taskId,
				)

				// Log the analysis
				this.store.logAnalysis({
					id: crypto.randomUUID(),
					timestamp: Math.floor(Date.now() / 1000),
					taskId,
					messagesAnalyzed: batch.length,
					tokensUsed: preprocessed.cleanedTokenEstimate * 2, // rough: input + output
					entriesCreated: writeResult.entriesCreated,
					entriesReinforced: writeResult.entriesReinforced,
				})

				// Run garbage collection
				this.store.garbageCollect()
			}
		} catch (error) {
			console.error("[MemoryOrchestrator] Analysis pipeline error:", error)
		} finally {
			this.analysisInFlight = false

			if (this.analysisQueued) {
				this.analysisQueued = false
				// Re-trigger with current state
				this.triggerAnalysis(messages, taskId, providerSettings)
			}
		}
	}

	/**
	 * Get the compiled user profile section for the system prompt.
	 */
	getUserProfileSection(): string {
		if (!this.store) return ""
		const entries = this.store.getScoredEntries(this.workspaceId)
		return compileMemoryPrompt(entries)
	}

	getStore(): MemoryStore {
		return this.store
	}

	close(): void {
		this.store.close()
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/memory/orchestrator.ts
git commit -m "feat(memory): add pipeline orchestrator with triggers, concurrency guard, and lifecycle"
```

---

## Task 9: Global Settings & Message Types

**Files:**
- Modify: `packages/types/src/global-settings.ts:238-241`
- Modify: `packages/types/src/vscode-extension-host.ts:107,586`

- [ ] **Step 1: Add memory settings to globalSettingsSchema**

In `packages/types/src/global-settings.ts`, before the closing `})` on line 241, add:

```typescript
	// Memory Learning
	memoryLearningEnabled: z.boolean().optional(),
	memoryApiConfigId: z.string().optional(),
	memoryAnalysisFrequency: z.number().optional(),
	memoryLearningDefaultEnabled: z.boolean().optional(),
```

- [ ] **Step 2: Add message types to vscode-extension-host.ts**

In `packages/types/src/vscode-extension-host.ts`:

Add to the `ExtensionMessage` type union (after line 107, the `"fileContent"` member):
```typescript
		| "memoryLearningState"
```

Add to the `WebviewMessage` type union (after line 586, the `"openSkillFile"` member):
```typescript
		| "toggleMemoryLearning"
		| "updateMemorySettings"
```

- [ ] **Step 3: Verify types compile**

Run: `cd packages/types && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/global-settings.ts packages/types/src/vscode-extension-host.ts
git commit -m "feat(memory): add memory learning settings and message types"
```

---

## Task 10: System Prompt Integration

**Files:**
- Modify: `src/core/prompts/system.ts:94-95`
- Modify: `src/core/prompts/sections/index.ts:11`

- [ ] **Step 1: Add getUserProfileSection to sections index**

In `src/core/prompts/sections/index.ts`, add after the last export (line 11):

```typescript
export { getUserProfileSection } from "../../../core/memory/prompt-compiler"
```

Wait — the prompt compiler export name doesn't match. We need to create a thin wrapper or just re-export. Since `compileMemoryPrompt` takes `ScoredMemoryEntry[]` not a config, the system.ts integration will call the orchestrator directly. So we skip this re-export and instead modify `system.ts` directly.

- [ ] **Step 2: Modify system.ts to inject userProfileSection**

In `src/core/prompts/system.ts`, the `generatePrompt()` function needs a new parameter for the memory orchestrator's output. Add a new parameter `userProfileSection?: string` to the function signature, and insert it in the template between `personalityParts.top` and `markdownFormattingSection()`.

At line 62, add to the function parameters:
```typescript
	userProfileSection?: string,
```

At lines 94-95, change:
```typescript
${personalityParts.top}
${markdownFormattingSection()}
```
to:
```typescript
${personalityParts.top}
${userProfileSection || ""}
${markdownFormattingSection()}
```

- [ ] **Step 3: Find and update all callers of generatePrompt**

Search for all places that call `generatePrompt(` to add the new parameter. The parameter is optional with a default of `undefined`, so existing callers should still compile. Verify with:

Run: `cd src && npx tsc --noEmit`
Expected: No errors (parameter is optional)

- [ ] **Step 4: Commit**

```bash
git add src/core/prompts/system.ts
git commit -m "feat(memory): inject user profile section into system prompt"
```

---

## Task 11: Extension Host Integration (ClineProvider + Message Handler)

**Files:**
- Modify: `src/core/webview/ClineProvider.ts`
- Modify: `src/core/webview/webviewMessageHandler.ts`

- [ ] **Step 1: Add orchestrator to ClineProvider**

In `src/core/webview/ClineProvider.ts`:

Add import near the top:
```typescript
import { MemoryOrchestrator } from "../memory/orchestrator"
```

Add instance variable in the class:
```typescript
private memoryOrchestrator?: MemoryOrchestrator
```

In the constructor (or an init method), after other initialization:
```typescript
// Initialize memory orchestrator
const storagePath = this.contextProxy.getValue("customStoragePath") || context.globalStorageUri.fsPath
const workspacePath = this.currentWorkspacePath
this.memoryOrchestrator = new MemoryOrchestrator(storagePath, workspacePath || null)
this.memoryOrchestrator.init().catch((err) => console.error("[Memory] Init failed:", err))

const memoryEnabled = this.contextProxy.getValue("memoryLearningEnabled") ?? false
this.memoryOrchestrator.setEnabled(memoryEnabled)
```

Add a getter for the orchestrator so `system.ts` can access the user profile:
```typescript
getMemoryOrchestrator(): MemoryOrchestrator | undefined {
	return this.memoryOrchestrator
}
```

- [ ] **Step 2: Add toggle handler to webviewMessageHandler.ts**

In `src/core/webview/webviewMessageHandler.ts`, add a new case before the `default:` case (around line 3696):

```typescript
case "toggleMemoryLearning": {
	const currentState = provider.getValue("memoryLearningEnabled") ?? false
	const newState = !currentState
	await provider.setValue("memoryLearningEnabled", newState)
	const orchestrator = provider.getMemoryOrchestrator()
	if (orchestrator) {
		orchestrator.setEnabled(newState)
	}
	await provider.postMessageToWebview({
		type: "memoryLearningState",
		text: String(newState),
	})
	break
}

case "updateMemorySettings": {
	if (message.text) {
		try {
			const settings = JSON.parse(message.text)
			if (settings.memoryApiConfigId !== undefined) {
				await provider.setValue("memoryApiConfigId", settings.memoryApiConfigId)
			}
			if (settings.memoryAnalysisFrequency !== undefined) {
				await provider.setValue("memoryAnalysisFrequency", settings.memoryAnalysisFrequency)
			}
			if (settings.memoryLearningDefaultEnabled !== undefined) {
				await provider.setValue("memoryLearningDefaultEnabled", settings.memoryLearningDefaultEnabled)
			}
		} catch (e) {
			console.error("[Memory] Failed to parse settings:", e)
		}
	}
	break
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd src && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/webview/ClineProvider.ts src/core/webview/webviewMessageHandler.ts
git commit -m "feat(memory): integrate orchestrator with extension host and message handlers"
```

---

## Task 12: Chat UI Toggle

**Files:**
- Modify: `webview-ui/src/components/chat/ChatTextArea.tsx`

- [ ] **Step 1: Add the memory toggle indicator**

In `ChatTextArea.tsx`, in the status indicators area (around line 1326), add the memory learning toggle:

```tsx
{/* Memory Learning Toggle */}
{(() => {
	const memoryConfigured = !!extensionState.memoryApiConfigId
	const memoryEnabled = extensionState.memoryLearningEnabled ?? false

	const dotColor = !memoryConfigured ? "bg-gray-400" : memoryEnabled ? "bg-green-500" : "bg-red-500"
	const label = !memoryConfigured ? "Memory: Not configured" : memoryEnabled ? "Memory Learning" : "Memory Paused"
	const tooltip = !memoryConfigured
		? "Select a model profile in Settings → Memory to enable"
		: memoryEnabled
			? "Roo learns your preferences from this conversation. Click to pause."
			: "Memory learning is paused. Click to resume."

	return (
		<button
			onClick={() => {
				if (memoryConfigured) {
					vscode.postMessage({ type: "toggleMemoryLearning" })
				}
			}}
			className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
			title={tooltip}
		>
			<span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
			<span>{label}</span>
		</button>
	)
})()}
```

This needs `extensionState` to include the memory settings. The `ExtensionStateContext` already provides the full state from `globalState`, and since we added the keys to `globalSettingsSchema`, they will be available.

- [ ] **Step 2: Verify the webview builds**

Run: `cd webview-ui && pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add webview-ui/src/components/chat/ChatTextArea.tsx
git commit -m "feat(memory): add memory learning toggle indicator to chat UI"
```

---

## Task 13: Settings View Configuration

**Files:**
- Modify: `webview-ui/src/components/settings/SettingsView.tsx`

- [ ] **Step 1: Add memory section to sectionNames and icons**

In `SettingsView.tsx`, add `"memory"` to the `sectionNames` array (around line 98) and add an icon mapping (around line 509):

In `sectionNames` (after `"experimental"`):
```typescript
"memory",
```

In the `sections` icon mapping:
```typescript
{ id: "memory", icon: Brain },  // import Brain from lucide-react
```

- [ ] **Step 2: Add the memory settings tab content**

Add a new tab content block following the existing pattern (after the experimental section):

```tsx
{renderTab === "memory" && (
	<div>
		<SectionHeader>Memory Learning</SectionHeader>
		<Section>
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					When enabled, Roo learns your preferences and coding style from conversations to personalize responses over time.
				</p>

				{/* Profile selector */}
				<div>
					<label className="text-sm font-medium">Analysis Model Profile</label>
					<p className="text-xs text-muted-foreground mb-1">
						Select a configuration profile with at least 50K context window.
					</p>
					<select
						value={cachedState.memoryApiConfigId || ""}
						onChange={(e) => {
							setCachedStateField("memoryApiConfigId", e.target.value || undefined)
						}}
						className="w-full p-2 border rounded"
					>
						<option value="">Not configured</option>
						{(cachedState.listApiConfigMeta || []).map((config: any) => (
							<option key={config.id} value={config.id}>
								{config.name}
							</option>
						))}
					</select>
				</div>

				{/* Analysis frequency */}
				<div>
					<label className="text-sm font-medium">Analysis Frequency</label>
					<p className="text-xs text-muted-foreground mb-1">
						Analyze conversation every N user messages.
					</p>
					<select
						value={cachedState.memoryAnalysisFrequency || 8}
						onChange={(e) => {
							setCachedStateField("memoryAnalysisFrequency", parseInt(e.target.value))
						}}
						className="w-full p-2 border rounded"
					>
						{[4, 6, 8, 10, 15, 20].map((n) => (
							<option key={n} value={n}>
								Every {n} messages
							</option>
						))}
					</select>
				</div>

				{/* Default enabled */}
				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={cachedState.memoryLearningDefaultEnabled ?? true}
						onChange={(e) => {
							setCachedStateField("memoryLearningDefaultEnabled", e.target.checked)
						}}
					/>
					<label className="text-sm">Enable by default for new sessions</label>
				</div>
			</div>
		</Section>
	</div>
)}
```

- [ ] **Step 3: Verify the webview builds**

Run: `cd webview-ui && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add webview-ui/src/components/settings/SettingsView.tsx
git commit -m "feat(memory): add memory learning settings section to SettingsView"
```

---

## Task 14: Build Pipeline (sql.js WASM)

**Files:**
- Modify: `src/esbuild.mjs` (potentially)

- [ ] **Step 1: Verify sql.js WASM handling**

The build already has a `copyWasms` plugin (line 66-69 in `src/esbuild.mjs`). Check if this correctly picks up `sql-wasm.wasm` from `node_modules/sql.js/dist/`.

Run: `ls node_modules/sql.js/dist/sql-wasm.wasm`
Expected: File exists

If `copyWasms` doesn't cover sql.js WASM paths, add the path to the copy list. Check `@roo-code/build`'s `copyWasms` implementation to see what globs it uses.

- [ ] **Step 2: Test full extension build**

Run: `pnpm build`
Expected: Build succeeds, `dist/` contains `sql-wasm.wasm` (or it's bundled)

- [ ] **Step 3: Commit if any build config changes were needed**

```bash
git add src/esbuild.mjs
git commit -m "build: ensure sql.js WASM files are included in extension bundle"
```

---

## Task 15: Integration Test — Full Pipeline

**Files:**
- Create: `src/core/memory/__tests__/orchestrator.spec.ts`

- [ ] **Step 1: Write integration tests**

```typescript
// src/core/memory/__tests__/orchestrator.spec.ts
import { MemoryStore } from "../memory-store"
import { preprocessMessages } from "../preprocessor"
import { processObservations, jaccardSimilarity } from "../memory-writer"
import { compileMemoryPrompt } from "../prompt-compiler"
import type { Observation } from "../types"
import * as path from "path"
import * as os from "os"
import * as fs from "fs"

describe("Memory System Integration", () => {
	let store: MemoryStore
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-test-"))
		store = new MemoryStore(tmpDir)
		await store.init()
	})

	afterEach(() => {
		store.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it("should persist entries across store instances", async () => {
		store.insertEntry({
			workspaceId: null,
			category: "coding-style",
			content: "Prefers TypeScript",
			significance: 0.9,
			firstSeen: 1000,
			lastReinforced: 1000,
			reinforcementCount: 1,
			decayRate: 0.05,
			sourceTaskId: null,
			isPinned: false,
		})
		store.close()

		// Open new store instance on same path
		const store2 = new MemoryStore(tmpDir)
		await store2.init()
		expect(store2.getEntryCount()).toBe(1)
		store2.close()
	})

	it("should process observations end-to-end", () => {
		const observations: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Prefers TypeScript over JavaScript",
				significance: 0.9,
				existingEntryId: null,
				reasoning: "Explicitly stated preference",
			},
			{
				action: "NEW",
				category: "communication-prefs",
				content: "Likes concise, direct responses",
				significance: 0.85,
				existingEntryId: null,
				reasoning: "Expressed multiple times",
			},
		]

		const result = processObservations(store, observations, null, "task-1")
		expect(result.entriesCreated).toBe(2)
		expect(store.getEntryCount()).toBe(2)
	})

	it("should compile entries into prose", () => {
		store.insertEntry({
			workspaceId: null,
			category: "coding-style",
			content: "Prefers TypeScript",
			significance: 0.9,
			firstSeen: Math.floor(Date.now() / 1000),
			lastReinforced: Math.floor(Date.now() / 1000),
			reinforcementCount: 5,
			decayRate: 0.05,
			sourceTaskId: null,
			isPinned: false,
		})

		const entries = store.getScoredEntries(null)
		const prose = compileMemoryPrompt(entries)
		expect(prose).toContain("USER PROFILE & PREFERENCES")
		expect(prose).toContain("Prefers TypeScript")
	})

	it("should preprocess messages and reduce token count", () => {
		const messages = [
			{ role: "user", content: [{ type: "text", text: "Fix the auth bug" }] },
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I'll check the auth module." },
					{ type: "tool_use", id: "1", name: "read_file", input: { path: "src/auth.ts" } },
					{ type: "tool_result", tool_use_id: "1", content: "... 500 lines ..." },
				],
			},
		]

		const result = preprocessMessages(messages)
		expect(result.cleaned).toContain("Fix the auth bug")
		expect(result.cleaned).toContain("→ read: src/auth.ts")
		expect(result.cleaned).not.toContain("500 lines")
		expect(result.cleanedTokenEstimate).toBeLessThan(result.originalTokenEstimate)
	})

	it("should garbage collect old low-score entries", async () => {
		const oldTimestamp = Math.floor(Date.now() / 1000) - 100 * 86400 // 100 days ago

		store.insertEntry({
			workspaceId: null,
			category: "active-projects",
			content: "Working on legacy migration",
			significance: 0.3,
			firstSeen: oldTimestamp,
			lastReinforced: oldTimestamp,
			reinforcementCount: 1,
			decayRate: 0.3,
			sourceTaskId: null,
			isPinned: false,
		})

		expect(store.getEntryCount()).toBe(1)
		const deleted = store.garbageCollect()
		expect(deleted).toBe(1)
		expect(store.getEntryCount()).toBe(0)
	})
})
```

- [ ] **Step 2: Run integration tests**

Run: `cd src && npx vitest run core/memory/__tests__/orchestrator.spec.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 3: Run all memory tests together**

Run: `cd src && npx vitest run core/memory/`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/memory/__tests__/orchestrator.spec.ts
git commit -m "test(memory): add integration tests for full memory pipeline"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run all project tests**

Run: `pnpm test`
Expected: All tests pass (existing + new)

- [ ] **Step 2: Run type checking**

Run: `pnpm check-types`
Expected: No type errors

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No lint errors from new files

- [ ] **Step 4: Test build**

Run: `pnpm build`
Expected: Extension builds successfully

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(memory): address lint, type, and build issues from final verification"
```
