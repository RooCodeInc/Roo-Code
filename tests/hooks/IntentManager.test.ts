// npx vitest run tests/hooks/IntentManager.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { IntentManager } from "../../src/hooks/IntentManager"
import { OrchestrationStorage } from "../../src/hooks/OrchestrationStorage"
import type { ActiveIntent } from "../../src/hooks/types"

vi.mock("../../src/hooks/OrchestrationStorage")
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/workspace",
				},
			},
		],
	},
}))

describe("IntentManager", () => {
	let intentManager: IntentManager
	let mockStorage: vi.Mocked<OrchestrationStorage>

	const mockIntents: ActiveIntent[] = [
		{
			id: "INT-001",
			name: "Feature A",
			description: "Implement feature A",
			status: "PENDING",
			ownedScope: ["src/features/a/**"],
			constraints: [],
			acceptanceCriteria: [],
		},
		{
			id: "INT-002",
			name: "Feature B",
			description: "Implement feature B",
			status: "IN_PROGRESS",
			ownedScope: ["src/features/b/**"],
			constraints: [],
			acceptanceCriteria: [],
		},
	]

	beforeEach(() => {
		mockStorage = {
			getOrchestrationDirectory: vi.fn().mockResolvedValue("/workspace/.orchestration"),
			ensureOrchestrationDirectory: vi.fn().mockResolvedValue(undefined),
			readFile: vi.fn(),
			writeFile: vi.fn(),
			appendFile: vi.fn(),
			fileExists: vi.fn(),
		} as unknown as vi.Mocked<OrchestrationStorage>

		intentManager = new IntentManager(mockStorage)
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("loadIntents", () => {
		it("should load intents from active_intents.yaml", async () => {
			const yamlContent = `intents:
  - id: INT-001
    name: Feature A
    description: Implement feature A
    status: PENDING
    ownedScope:
      - src/features/a/**
    constraints: []
    acceptanceCriteria: []
  - id: INT-002
    name: Feature B
    description: Implement feature B
    status: IN_PROGRESS
    ownedScope:
      - src/features/b/**
    constraints: []
    acceptanceCriteria: []`

			mockStorage.fileExists.mockResolvedValue(true)
			mockStorage.readFile.mockResolvedValue(yamlContent)

			const intents = await intentManager.loadIntents()

			expect(mockStorage.readFile).toHaveBeenCalledWith("active_intents.yaml")
			expect(intents).toHaveLength(2)
			expect(intents[0].id).toBe("INT-001")
			expect(intents[1].id).toBe("INT-002")
		})

		it("should return empty array if active_intents.yaml does not exist", async () => {
			mockStorage.fileExists.mockResolvedValue(false)

			const intents = await intentManager.loadIntents()

			expect(intents).toEqual([])
			expect(mockStorage.readFile).not.toHaveBeenCalled()
		})

		it("should handle malformed YAML gracefully", async () => {
			mockStorage.fileExists.mockResolvedValue(true)
			mockStorage.readFile.mockResolvedValue("invalid: yaml: content: [")

			await expect(intentManager.loadIntents()).rejects.toThrow()
		})
	})

	describe("getIntent", () => {
		it("should return intent by ID", async () => {
			mockStorage.fileExists.mockResolvedValue(true)
			mockStorage.readFile.mockResolvedValue(`intents:
  - id: INT-001
    name: Feature A
    status: PENDING
    ownedScope: []
    constraints: []
    acceptanceCriteria: []`)

			const intent = await intentManager.getIntent("INT-001")

			expect(intent).toBeDefined()
			expect(intent?.id).toBe("INT-001")
		})

		it("should return null if intent not found", async () => {
			mockStorage.fileExists.mockResolvedValue(true)
			mockStorage.readFile.mockResolvedValue(`intents:
  - id: INT-001
    name: Feature A
    status: PENDING
    ownedScope: []
    constraints: []
    acceptanceCriteria: []`)

			const intent = await intentManager.getIntent("INT-999")

			expect(intent).toBeNull()
		})
	})

	describe("setActiveIntent", () => {
		it("should set active intent for a task", async () => {
			mockStorage.fileExists.mockResolvedValue(true)
			mockStorage.readFile.mockResolvedValue(`intents:
  - id: INT-001
    name: Feature A
    status: PENDING
    ownedScope: []
    constraints: []
    acceptanceCriteria: []`)

			await intentManager.setActiveIntent("task-123", "INT-001")

			const activeIntent = await intentManager.getActiveIntent("task-123")
			expect(activeIntent).toBeDefined()
			expect(activeIntent?.id).toBe("INT-001")
		})

		it("should throw error if intent does not exist", async () => {
			mockStorage.fileExists.mockResolvedValue(true)
			mockStorage.readFile.mockResolvedValue(`intents:
  - id: INT-001
    name: Feature A
    status: PENDING
    ownedScope: []
    constraints: []
    acceptanceCriteria: []`)

			await expect(intentManager.setActiveIntent("task-123", "INT-999")).rejects.toThrow(
				"Intent INT-999 not found",
			)
		})
	})

	describe("getActiveIntent", () => {
		it("should return active intent for a task", async () => {
			mockStorage.fileExists.mockResolvedValue(true)
			mockStorage.readFile.mockResolvedValue(`intents:
  - id: INT-001
    name: Feature A
    status: PENDING
    ownedScope: []
    constraints: []
    acceptanceCriteria: []`)

			await intentManager.setActiveIntent("task-123", "INT-001")
			const activeIntent = await intentManager.getActiveIntent("task-123")

			expect(activeIntent).toBeDefined()
			expect(activeIntent?.id).toBe("INT-001")
		})

		it("should return null if no active intent for task", async () => {
			const activeIntent = await intentManager.getActiveIntent("task-123")

			expect(activeIntent).toBeNull()
		})
	})

	describe("clearActiveIntent", () => {
		it("should clear active intent for a task", async () => {
			mockStorage.fileExists.mockResolvedValue(true)
			mockStorage.readFile.mockResolvedValue(`intents:
  - id: INT-001
    name: Feature A
    status: PENDING
    ownedScope: []
    constraints: []
    acceptanceCriteria: []`)

			await intentManager.setActiveIntent("task-123", "INT-001")
			await intentManager.clearActiveIntent("task-123")

			const activeIntent = await intentManager.getActiveIntent("task-123")
			expect(activeIntent).toBeNull()
		})
	})
})
