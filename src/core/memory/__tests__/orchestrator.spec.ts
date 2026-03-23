import { MemoryStore } from "../memory-store"
import { MemoryOrchestrator } from "../orchestrator"
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

describe("clearAllMemory", () => {
	let store: MemoryStore
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-clear-test-"))
		store = new MemoryStore(tmpDir)
		await store.init()
	})

	afterEach(() => {
		store.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it("should delete all entries", async () => {
		// Insert several entries
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
		store.insertEntry({
			workspaceId: null,
			category: "communication-prefs",
			content: "Likes concise responses",
			significance: 0.85,
			firstSeen: 2000,
			lastReinforced: 2000,
			reinforcementCount: 1,
			decayRate: 0.05,
			sourceTaskId: null,
			isPinned: false,
		})
		store.insertEntry({
			workspaceId: null,
			category: "tool-preferences",
			content: "Uses VS Code with Vim keybindings",
			significance: 0.7,
			firstSeen: 3000,
			lastReinforced: 3000,
			reinforcementCount: 1,
			decayRate: 0.12,
			sourceTaskId: null,
			isPinned: false,
		})

		// Verify entries were inserted
		expect(store.getEntryCount()).toBe(3)

		// Clear all entries
		store.deleteAllEntries()

		// Verify all entries are gone
		expect(store.getEntryCount()).toBe(0)
	})

	it("should persist the cleared state", async () => {
		// Insert entries
		store.insertEntry({
			workspaceId: null,
			category: "coding-style",
			content: "Prefers functional components",
			significance: 0.8,
			firstSeen: 1000,
			lastReinforced: 1000,
			reinforcementCount: 1,
			decayRate: 0.05,
			sourceTaskId: null,
			isPinned: false,
		})
		store.insertEntry({
			workspaceId: null,
			category: "active-projects",
			content: "Working on memory system",
			significance: 0.75,
			firstSeen: 2000,
			lastReinforced: 2000,
			reinforcementCount: 1,
			decayRate: 0.3,
			sourceTaskId: null,
			isPinned: false,
		})

		expect(store.getEntryCount()).toBe(2)

		// Delete all entries and close the store
		store.deleteAllEntries()
		expect(store.getEntryCount()).toBe(0)
		store.close()

		// Reopen store on the same path
		const store2 = new MemoryStore(tmpDir)
		await store2.init()

		// Verify cleared state persisted across instances
		expect(store2.getEntryCount()).toBe(0)
		store2.close()
	})
})

describe("MemoryOrchestrator.onUserMessage", () => {
	let orchestrator: MemoryOrchestrator
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-orch-test-"))
		orchestrator = new MemoryOrchestrator(tmpDir, null)
		await orchestrator.init()
	})

	afterEach(() => {
		orchestrator.close()
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it("should skip analysis when provider settings is null", () => {
		orchestrator.setEnabled(true)
		const result = orchestrator.onUserMessage([], "task-1", null)
		expect(result).toBe(false)
	})

	it("should skip analysis when not enabled", () => {
		orchestrator.setEnabled(false)
		const result = orchestrator.onUserMessage([], "task-1", { apiProvider: "openai" } as any)
		expect(result).toBe(false)
	})
})
