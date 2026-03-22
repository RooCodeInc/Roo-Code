import { MemoryStore } from "../memory-store"
import { preprocessMessages } from "../preprocessor"
import { processObservations } from "../memory-writer"
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

	it("should compile entries into prose with correct header", () => {
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
		expect(entries.length).toBeGreaterThan(0)
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
				],
			},
		]

		const result = preprocessMessages(messages)
		expect(result.cleaned).toContain("Fix the auth bug")
		expect(result.cleaned).toContain("→ read: src/auth.ts")
		expect(result.cleanedTokenEstimate).toBeLessThanOrEqual(result.originalTokenEstimate)
	})

	it("should garbage collect old low-score entries", async () => {
		const oldTimestamp = Math.floor(Date.now() / 1000) - 100 * 86400

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

	it("should deduplicate similar observations", () => {
		// Insert initial entry
		const obs1: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Prefers functional React components with hooks",
				significance: 0.8,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		processObservations(store, obs1, null, "task-1")
		expect(store.getEntryCount()).toBe(1)

		// Try inserting a similar entry — should be deduped into a reinforce
		const obs2: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "Prefers functional React components with hooks pattern",
				significance: 0.85,
				existingEntryId: null,
				reasoning: "test",
			},
		]
		const result = processObservations(store, obs2, null, "task-2")
		expect(result.entriesReinforced).toBe(1)
		expect(result.entriesCreated).toBe(0)
		expect(store.getEntryCount()).toBe(1) // Still just 1 entry
	})

	it("should reject PII-containing observations", () => {
		const obs: Observation[] = [
			{
				action: "NEW",
				category: "coding-style",
				content: "User email is john@example.com and prefers TypeScript",
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
})
