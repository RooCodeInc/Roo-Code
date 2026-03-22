import * as path from "path"
import * as os from "os"
import * as fs from "fs"
import { MemoryStore } from "../memory-store"
import { preprocessMessages } from "../preprocessor"
import { processObservations, containsPII, jaccardSimilarity } from "../memory-writer"
import { compileMemoryPrompt, compileMemoryForAgent } from "../prompt-compiler"
import { computeScore } from "../scoring"
import type { Observation, MemoryCategorySlug, ScoredMemoryEntry } from "../types"
import { MEMORY_CONSTANTS, DEFAULT_MEMORY_CATEGORIES } from "../types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(): { store: MemoryStore; tmpDir: string } {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-e2e-"))
	return { store: new MemoryStore(tmpDir), tmpDir }
}

const NOW = Math.floor(Date.now() / 1000)

function daysAgo(days: number): number {
	return NOW - days * 86400
}

function makeEntry(overrides: Partial<Parameters<MemoryStore["insertEntry"]>[0]> = {}) {
	return {
		workspaceId: null as string | null,
		category: "coding-style" as MemoryCategorySlug,
		content: "Prefers TypeScript over JavaScript",
		significance: 0.8,
		firstSeen: NOW,
		lastReinforced: NOW,
		reinforcementCount: 1,
		decayRate: 0.05,
		sourceTaskId: null as string | null,
		isPinned: false,
		...overrides,
	}
}

// ---------------------------------------------------------------------------
// 1. Full Pipeline — preprocessor → mock analysis → writer → compiler
// ---------------------------------------------------------------------------
describe("E2E: Full Pipeline (mock LLM)", () => {
	let store: MemoryStore
	let tmpDir: string

	beforeEach(async () => {
		;({ store, tmpDir } = makeStore())
		await store.init()
	})

	afterEach(() => {
		store.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it("should flow from raw messages through to compiled prompt", () => {
		// --- Step 1: Preprocess raw messages ---
		const rawMessages = [
			{ role: "user", content: "I always use TypeScript with strict mode. Never plain JS." },
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Got it — I'll use TypeScript with strict mode." },
					{ type: "tool_use", id: "t1", name: "read_file", input: { path: "tsconfig.json" } },
				],
			},
			{ role: "user", content: "I prefer functional React components with hooks, not classes." },
			{
				role: "assistant",
				content: "Understood, I'll stick with functional components and hooks.",
			},
			{ role: "user", content: "Keep responses concise. No over-explaining." },
		]

		const preprocessed = preprocessMessages(rawMessages)
		expect(preprocessed.cleaned).toContain("TypeScript with strict mode")
		expect(preprocessed.cleaned).toContain("→ read: tsconfig.json")
		expect(preprocessed.cleaned).toContain("functional React components")
		expect(preprocessed.cleaned).toContain("concise")
		expect(preprocessed.cleanedTokenEstimate).toBeLessThanOrEqual(preprocessed.originalTokenEstimate)

		// --- Step 2: Simulate LLM analysis output ---
		const mockObservations: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Uses TypeScript with strict mode enabled, avoids plain JavaScript",
				significance: 0.9,
				existingEntryId: null,
				reasoning: "Explicitly stated twice",
			},
			{
				action: "NEW",
				category: "coding-style",
				content: "Prefers functional React components with hooks over class components",
				significance: 0.85,
				existingEntryId: null,
				reasoning: "Direct statement",
			},
			{
				action: "NEW",
				category: "communication-prefs",
				content: "Wants concise responses without over-explanation",
				significance: 0.8,
				existingEntryId: null,
				reasoning: "Explicit request",
			},
		]

		// --- Step 3: Write observations to store ---
		const writeResult = processObservations(store, mockObservations, null, "task-e2e-1")
		expect(writeResult.entriesCreated).toBe(3)
		expect(writeResult.entriesSkipped).toBe(0)
		expect(store.getEntryCount()).toBe(3)

		// --- Step 4: Compile to system prompt ---
		const scoredEntries = store.getScoredEntries(null)
		expect(scoredEntries.length).toBe(3)

		const prose = compileMemoryPrompt(scoredEntries)
		expect(prose).toContain("USER PROFILE & PREFERENCES")
		expect(prose).toContain("Learned through conversation")
		expect(prose).toContain("TypeScript with strict mode")
		expect(prose).toContain("functional React components")
		expect(prose).toContain("concise responses")

		// --- Step 5: Agent-format compilation (with IDs) ---
		const agentReport = compileMemoryForAgent(scoredEntries)
		expect(agentReport).toContain("coding-style")
		expect(agentReport).toContain("communication-prefs")
		// Each line should have [id] category (score: X.XX): content format
		for (const entry of scoredEntries) {
			expect(agentReport).toContain(`[${entry.id}]`)
		}
	})

	it("should handle multi-turn conversation with reinforcement", () => {
		// Round 1: initial observations
		const round1: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Prefers functional React components with hooks",
				significance: 0.85,
				existingEntryId: null,
				reasoning: "First mention",
			},
		]
		const r1 = processObservations(store, round1, null, "task-1")
		expect(r1.entriesCreated).toBe(1)

		// Round 2: LLM sees existing memory, sends REINFORCE
		const entries = store.getScoredEntries(null)
		const targetId = entries[0].id
		const round2: Observation[] = [
			{
				action: "REINFORCE",
				category: "coding-style",
				content: "Prefers functional React components with hooks",
				significance: 0.85,
				existingEntryId: targetId,
				reasoning: "Confirmed again",
			},
		]
		const r2 = processObservations(store, round2, null, "task-2")
		expect(r2.entriesReinforced).toBe(1)
		expect(store.getEntryCount()).toBe(1) // still 1

		// Verify reinforcement count bumped
		const updated = store.getEntry(targetId)!
		expect(updated.reinforcementCount).toBe(2)
	})

	it("should handle UPDATE action replacing content", () => {
		const initial: Observation[] = [
			{
				action: "NEW",
				category: "tool-preferences",
				content: "Uses ESLint for linting",
				significance: 0.7,
				existingEntryId: null,
				reasoning: "Seen in config",
			},
		]
		processObservations(store, initial, null, "task-1")
		const id = store.getScoredEntries(null)[0].id

		const update: Observation[] = [
			{
				action: "UPDATE",
				category: "tool-preferences",
				content: "Switched from ESLint to Biome for linting and formatting",
				significance: 0.75,
				existingEntryId: id,
				reasoning: "User explicitly changed tooling",
			},
		]
		const r = processObservations(store, update, null, "task-2")
		expect(r.entriesReinforced).toBe(1)

		const entry = store.getEntry(id)!
		expect(entry.content).toBe("Switched from ESLint to Biome for linting and formatting")
		expect(entry.significance).toBe(0.75)
		expect(entry.reinforcementCount).toBe(2)
	})
})

// ---------------------------------------------------------------------------
// 2. Scoring Lifecycle — insert, score ordering, garbage collection, cap
// ---------------------------------------------------------------------------
describe("E2E: Scoring Lifecycle", () => {
	let store: MemoryStore
	let tmpDir: string

	beforeEach(async () => {
		;({ store, tmpDir } = makeStore())
		await store.init()
	})

	afterEach(() => {
		store.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it("should return entries in descending score order", () => {
		// High-significance, recently reinforced → high score
		store.insertEntry(
			makeEntry({
				content: "High scorer",
				significance: 0.95,
				reinforcementCount: 5,
				lastReinforced: NOW,
				decayRate: 0.05,
			}),
		)

		// Medium
		store.insertEntry(
			makeEntry({
				content: "Medium scorer",
				significance: 0.6,
				reinforcementCount: 2,
				lastReinforced: daysAgo(10),
				decayRate: 0.1,
			}),
		)

		// Low — old, decayed
		store.insertEntry(
			makeEntry({
				content: "Low scorer",
				significance: 0.4,
				reinforcementCount: 1,
				lastReinforced: daysAgo(60),
				decayRate: 0.15,
			}),
		)

		const scored = store.getScoredEntries(null)
		expect(scored.length).toBeGreaterThanOrEqual(2)

		// First entry should be the highest scorer
		expect(scored[0].content).toBe("High scorer")

		// Scores should be in descending order
		for (let i = 1; i < scored.length; i++) {
			expect(scored[i - 1].computedScore).toBeGreaterThanOrEqual(scored[i].computedScore)
		}
	})

	it("should garbage collect old low-score entries", () => {
		// Entry that should survive: recent, high score
		store.insertEntry(
			makeEntry({
				content: "Survivor",
				significance: 0.9,
				reinforcementCount: 5,
				lastReinforced: NOW,
			}),
		)

		// Entry that should be GC'd: old, low significance, high decay
		store.insertEntry(
			makeEntry({
				content: "Doomed",
				significance: 0.2,
				reinforcementCount: 1,
				lastReinforced: daysAgo(120),
				decayRate: 0.3,
				category: "active-projects",
			}),
		)

		expect(store.getEntryCount()).toBe(2)
		const deleted = store.garbageCollect()
		expect(deleted).toBe(1)
		expect(store.getEntryCount()).toBe(1)

		// The survivor should still be there
		const remaining = store.getScoredEntries(null)
		expect(remaining[0].content).toBe("Survivor")
	})

	it("should enforce the 500-entry hard cap", () => {
		// Insert 505 entries — oldest/lowest score ones should get pruned
		for (let i = 0; i < 505; i++) {
			store.insertEntry(
				makeEntry({
					content: `Entry number ${i}`,
					significance: i < 5 ? 0.1 : 0.8, // First 5 are low significance
					reinforcementCount: 1,
					lastReinforced: i < 5 ? daysAgo(100) : NOW, // First 5 are old
					decayRate: i < 5 ? 0.3 : 0.05,
				}),
			)
		}

		expect(store.getEntryCount()).toBe(505)
		const deleted = store.garbageCollect()
		expect(deleted).toBeGreaterThanOrEqual(5) // At least 5 must go
		expect(store.getEntryCount()).toBeLessThanOrEqual(MEMORY_CONSTANTS.MAX_ENTRIES)
	})

	it("should not garbage collect pinned entries even if old/low-score", () => {
		store.insertEntry(
			makeEntry({
				content: "Pinned forever",
				significance: 0.2,
				reinforcementCount: 1,
				lastReinforced: daysAgo(200),
				decayRate: 0.3,
				isPinned: true,
			}),
		)

		const deleted = store.garbageCollect()
		expect(deleted).toBe(0)
		expect(store.getEntryCount()).toBe(1)
	})

	it("should filter entries below the score threshold from getScoredEntries", () => {
		// A very old, very decayed entry should fall below 0.05 threshold
		store.insertEntry(
			makeEntry({
				content: "Ancient entry",
				significance: 0.1,
				reinforcementCount: 1,
				lastReinforced: daysAgo(365),
				decayRate: 0.3,
			}),
		)

		const scored = store.getScoredEntries(null)
		// Should be excluded due to score < 0.05
		expect(scored.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// 3. Workspace Scoping — global vs workspace entries
// ---------------------------------------------------------------------------
describe("E2E: Workspace Scoping", () => {
	let store: MemoryStore
	let tmpDir: string

	const WORKSPACE_A = "ws-alpha-1234"
	const WORKSPACE_B = "ws-beta-5678"

	beforeEach(async () => {
		;({ store, tmpDir } = makeStore())
		await store.init()
	})

	afterEach(() => {
		store.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it("should include global entries in all workspace queries", () => {
		// Global entry (workspaceId = null)
		store.insertEntry(
			makeEntry({
				content: "Global: Prefers TypeScript",
				workspaceId: null,
			}),
		)

		// Workspace A entry
		store.insertEntry(
			makeEntry({
				content: "WS-A: Working on the API redesign",
				workspaceId: WORKSPACE_A,
				category: "active-projects",
			}),
		)

		// Query with workspace A — should see both global + workspace A
		const wsAEntries = store.getScoredEntries(WORKSPACE_A)
		const wsAContents = wsAEntries.map((e) => e.content)
		expect(wsAContents).toContain("Global: Prefers TypeScript")
		expect(wsAContents).toContain("WS-A: Working on the API redesign")

		// Query with workspace B — should only see global
		const wsBEntries = store.getScoredEntries(WORKSPACE_B)
		const wsBContents = wsBEntries.map((e) => e.content)
		expect(wsBContents).toContain("Global: Prefers TypeScript")
		expect(wsBContents).not.toContain("WS-A: Working on the API redesign")

		// Query with null workspace — should only see global
		const globalEntries = store.getScoredEntries(null)
		const globalContents = globalEntries.map((e) => e.content)
		expect(globalContents).toContain("Global: Prefers TypeScript")
		expect(globalContents).not.toContain("WS-A: Working on the API redesign")
	})

	it("should scope active-projects observations to their workspace", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "active-projects",
				content: "Building a real-time dashboard with WebSockets",
				significance: 0.7,
				existingEntryId: null,
				reasoning: "Mentioned in conversation",
			},
		]

		processObservations(store, obs, WORKSPACE_A, "task-1")
		const entry = store.getEntry(store.getScoredEntries(WORKSPACE_A)[0].id)!
		expect(entry.workspaceId).toBe(WORKSPACE_A)
	})

	it("should scope coding-style and communication-prefs globally", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Strongly prefers const over let",
				significance: 0.8,
				existingEntryId: null,
				reasoning: "test",
			},
			{
				action: "NEW",
				category: "communication-prefs",
				content: "Likes numbered steps in responses",
				significance: 0.75,
				existingEntryId: null,
				reasoning: "test",
			},
		]

		processObservations(store, obs, WORKSPACE_A, "task-1")

		// Both should be globally visible
		const wsA = store.getScoredEntries(WORKSPACE_A)
		const wsB = store.getScoredEntries(WORKSPACE_B)
		const global = store.getScoredEntries(null)

		expect(wsA.length).toBe(2)
		expect(wsB.length).toBe(2)
		expect(global.length).toBe(2)
	})

	it("should keep workspace entries isolated between different workspaces", () => {
		// Insert workspace-scoped entries for two different workspaces
		store.insertEntry(
			makeEntry({
				content: "Project Alpha backend migration",
				workspaceId: WORKSPACE_A,
				category: "active-projects",
			}),
		)
		store.insertEntry(
			makeEntry({
				content: "Project Beta frontend redesign",
				workspaceId: WORKSPACE_B,
				category: "active-projects",
			}),
		)

		const wsA = store.getScoredEntries(WORKSPACE_A)
		const wsB = store.getScoredEntries(WORKSPACE_B)

		expect(wsA.map((e) => e.content)).toContain("Project Alpha backend migration")
		expect(wsA.map((e) => e.content)).not.toContain("Project Beta frontend redesign")

		expect(wsB.map((e) => e.content)).toContain("Project Beta frontend redesign")
		expect(wsB.map((e) => e.content)).not.toContain("Project Alpha backend migration")
	})
})

// ---------------------------------------------------------------------------
// 4. PII Rejection
// ---------------------------------------------------------------------------
describe("E2E: PII Rejection", () => {
	let store: MemoryStore
	let tmpDir: string

	beforeEach(async () => {
		;({ store, tmpDir } = makeStore())
		await store.init()
	})

	afterEach(() => {
		store.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it("should reject observations containing email addresses", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "User email is developer@company.com and prefers React",
				significance: 0.8,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		expect(result.entriesSkipped).toBe(1)
		expect(result.entriesCreated).toBe(0)
		expect(store.getEntryCount()).toBe(0)
	})

	it("should reject observations containing OpenAI API keys", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "tool-preferences",
				content: "Uses API key sk-abcdefghij1234567890abcdefghij",
				significance: 0.6,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		expect(result.entriesSkipped).toBe(1)
		expect(store.getEntryCount()).toBe(0)
	})

	it("should reject observations containing GitHub PATs", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "tool-preferences",
				content: "GitHub token is ghp_abcdefghijklmnopqrstuvwxyz1234567890",
				significance: 0.6,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		expect(result.entriesSkipped).toBe(1)
		expect(store.getEntryCount()).toBe(0)
	})

	it("should reject observations containing phone numbers", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "communication-prefs",
				content: "Contact number is 555-123-4567",
				significance: 0.5,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		expect(result.entriesSkipped).toBe(1)
		expect(store.getEntryCount()).toBe(0)
	})

	it("should reject observations containing SSN patterns", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "behavioral-patterns",
				content: "SSN is 123-45-6789",
				significance: 0.5,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		expect(result.entriesSkipped).toBe(1)
		expect(store.getEntryCount()).toBe(0)
	})

	it("should reject observations containing AWS access keys", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "tool-preferences",
				content: "AWS key AKIAIOSFODNN7EXAMPLE",
				significance: 0.6,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		expect(result.entriesSkipped).toBe(1)
		expect(store.getEntryCount()).toBe(0)
	})

	it("should reject observations containing private keys", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Has -----BEGIN RSA PRIVATE KEY----- in repo",
				significance: 0.5,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		expect(result.entriesSkipped).toBe(1)
		expect(store.getEntryCount()).toBe(0)
	})

	it("should accept clean observations alongside rejecting PII ones", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Prefers TypeScript strict mode",
				significance: 0.9,
				existingEntryId: null,
				reasoning: "clean",
			},
			{
				action: "NEW",
				category: "communication-prefs",
				content: "User email is john@corp.com and likes detailed explanations",
				significance: 0.8,
				existingEntryId: null,
				reasoning: "has PII",
			},
			{
				action: "NEW",
				category: "dislikes-frustrations",
				content: "Dislikes verbose error messages",
				significance: 0.7,
				existingEntryId: null,
				reasoning: "clean",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		expect(result.entriesCreated).toBe(2) // two clean ones
		expect(result.entriesSkipped).toBe(1) // one PII
		expect(store.getEntryCount()).toBe(2)
	})

	it("containsPII should not flag normal technical content", () => {
		expect(containsPII("Uses React 18 with concurrent features")).toBe(false)
		expect(containsPII("Prefers ESLint + Prettier workflow")).toBe(false)
		expect(containsPII("Dislikes tabs, prefers 2-space indentation")).toBe(false)
		expect(containsPII("Working on src/auth/login.ts")).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// 5. Deduplication
// ---------------------------------------------------------------------------
describe("E2E: Deduplication", () => {
	let store: MemoryStore
	let tmpDir: string

	beforeEach(async () => {
		;({ store, tmpDir } = makeStore())
		await store.init()
	})

	afterEach(() => {
		store.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it("should convert near-duplicate NEW observations into REINFORCE", () => {
		const round1: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Prefers functional React components with hooks",
				significance: 0.85,
				existingEntryId: null,
				reasoning: "First mention",
			},
		]
		processObservations(store, round1, null, "task-1")
		expect(store.getEntryCount()).toBe(1)

		// Very similar observation — should be deduped
		const round2: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Prefers functional React components with hooks pattern",
				significance: 0.9,
				existingEntryId: null,
				reasoning: "Second mention with slight wording change",
			},
		]
		const result = processObservations(store, round2, null, "task-2")
		expect(result.entriesReinforced).toBe(1)
		expect(result.entriesCreated).toBe(0)
		expect(store.getEntryCount()).toBe(1)

		// Reinforcement count should have bumped
		const entries = store.getScoredEntries(null)
		expect(entries[0].reinforcementCount).toBe(2)
	})

	it("should NOT deduplicate sufficiently different observations", () => {
		const round1: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Prefers functional React components with hooks",
				significance: 0.85,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		processObservations(store, round1, null, "task-1")

		// Completely different observation in same category
		const round2: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Uses Tailwind CSS for styling instead of CSS modules",
				significance: 0.7,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		const result = processObservations(store, round2, null, "task-2")
		expect(result.entriesCreated).toBe(1)
		expect(result.entriesReinforced).toBe(0)
		expect(store.getEntryCount()).toBe(2)
	})

	it("should deduplicate across multiple rounds", () => {
		const base: Observation[] = [
			{
				action: "NEW",
				category: "communication-prefs",
				content: "Prefers concise direct responses without fluff always",
				significance: 0.8,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		processObservations(store, base, null, "task-1")

		// Round 2: slightly reworded — keeps most words the same for Jaccard ≥ 0.6
		processObservations(
			store,
			[
				{
					action: "NEW",
					category: "communication-prefs",
					content: "Prefers concise direct responses without fluff pattern",
					significance: 0.82,
					existingEntryId: null,
					reasoning: "test",
				},
			],
			null,
			"task-2",
		)

		// Round 3: another slight variation — still high Jaccard with the stored entry
		processObservations(
			store,
			[
				{
					action: "NEW",
					category: "communication-prefs",
					content: "Prefers concise direct responses without fluff style",
					significance: 0.85,
					existingEntryId: null,
					reasoning: "test",
				},
			],
			null,
			"task-3",
		)

		// Should still be just 1 entry, reinforced 3 times total
		expect(store.getEntryCount()).toBe(1)
		const entries = store.getScoredEntries(null)
		expect(entries[0].reinforcementCount).toBe(3)
	})

	it("should handle REINFORCE with invalid entry ID gracefully", () => {
		const obs: Observation[] = [
			{
				action: "REINFORCE",
				category: "coding-style",
				content: "Uses TypeScript",
				significance: 0.8,
				existingEntryId: "nonexistent-uuid-12345",
				reasoning: "LLM hallucinated this ID",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		expect(result.entriesSkipped).toBe(1)
		expect(store.getEntryCount()).toBe(0) // Nothing written
	})

	it("should handle UPDATE with invalid entry ID by treating as NEW with dedup", () => {
		// Pre-populate a similar entry
		store.insertEntry(
			makeEntry({
				content: "Prefers Vitest for testing React components apps",
			}),
		)

		const obs: Observation[] = [
			{
				action: "UPDATE",
				category: "coding-style",
				content: "Prefers Vitest for testing React components patterns",
				significance: 0.85,
				existingEntryId: "bogus-id-that-doesnt-exist",
				reasoning: "LLM hallucinated ID",
			},
		]
		const result = processObservations(store, obs, null, "task-1")
		// Should have found the similar entry via dedup and updated it
		expect(result.entriesReinforced).toBe(1)
		expect(result.entriesCreated).toBe(0)
		expect(store.getEntryCount()).toBe(1)
	})

	it("jaccardSimilarity threshold should be 0.6", () => {
		expect(MEMORY_CONSTANTS.DEDUP_SIMILARITY_THRESHOLD).toBe(0.6)

		// Just above threshold — considered duplicate
		const highSim = jaccardSimilarity(
			"Prefers functional React components with hooks",
			"Prefers functional React components using hooks pattern",
		)
		expect(highSim).toBeGreaterThanOrEqual(0.6)

		// Just below threshold — considered distinct
		const lowSim = jaccardSimilarity(
			"Prefers functional React components with hooks",
			"Uses Tailwind CSS for styling applications",
		)
		expect(lowSim).toBeLessThan(0.6)
	})
})

// ---------------------------------------------------------------------------
// 6. Data persistence across store reopens
// ---------------------------------------------------------------------------
describe("E2E: Persistence", () => {
	it("should survive store close and reopen", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-persist-"))

		// Session 1: write data
		const store1 = new MemoryStore(tmpDir)
		await store1.init()
		store1.insertEntry(
			makeEntry({ content: "Persisted entry alpha" }),
		)
		store1.insertEntry(
			makeEntry({ content: "Persisted entry beta", category: "communication-prefs" }),
		)
		expect(store1.getEntryCount()).toBe(2)
		store1.close()

		// Session 2: reopen, verify data intact
		const store2 = new MemoryStore(tmpDir)
		await store2.init()
		expect(store2.getEntryCount()).toBe(2)

		const scored = store2.getScoredEntries(null)
		const contents = scored.map((e) => e.content)
		expect(contents).toContain("Persisted entry alpha")
		expect(contents).toContain("Persisted entry beta")

		store2.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})
})

// ---------------------------------------------------------------------------
// 7. Prompt compiler token cap
// ---------------------------------------------------------------------------
describe("E2E: Prompt Compiler Token Cap", () => {
	let store: MemoryStore
	let tmpDir: string

	beforeEach(async () => {
		;({ store, tmpDir } = makeStore())
		await store.init()
	})

	afterEach(() => {
		store.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it("should respect the 1500-token cap", () => {
		// Insert a lot of entries to exceed the token budget
		for (let i = 0; i < 40; i++) {
			store.insertEntry(
				makeEntry({
					content: `This is a moderately long observation number ${i} about user coding preferences and behavioral patterns that should contribute meaningful tokens to the output`,
					significance: 0.8,
					reinforcementCount: 3,
					category: (["coding-style", "communication-prefs", "technical-proficiency", "tool-preferences"] as MemoryCategorySlug[])[i % 4],
				}),
			)
		}

		const entries = store.getScoredEntries(null)
		const prose = compileMemoryPrompt(entries)

		// The token estimate for the compiled prose should be within the cap
		const tokenEstimate = Math.ceil(prose.length / 4)
		expect(tokenEstimate).toBeLessThanOrEqual(MEMORY_CONSTANTS.PROMPT_TOKEN_CAP + 200) // small buffer for header
	})

	it("should return empty string when no entries exist", () => {
		const entries = store.getScoredEntries(null)
		const prose = compileMemoryPrompt(entries)
		expect(prose).toBe("")
	})
})
