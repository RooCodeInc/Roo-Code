// npx vitest core/tools/__tests__/attemptCompletionDelegation.spec.ts

import type { HistoryItem } from "@roo-code/types"
import type { DelegationMeta } from "../../task-persistence/delegationMeta"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
		})),
	},
	env: {
		uriScheme: "vscode",
	},
}))

vi.mock("../../../shared/package", () => ({
	Package: {
		name: "roo-cline",
		publisher: "RooVeterinaryInc",
		version: "1.0.0",
		outputChannel: "Roo-Code",
	},
}))

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg: string) => `Tool Error: ${msg}`),
		toolResult: vi.fn((text: string) => text),
		toolDenied: vi.fn(() => "The user denied this operation."),
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCompleted: vi.fn(),
		},
	},
}))

import { AttemptCompletionTool } from "../AttemptCompletionTool"

/** Helper: minimal HistoryItem for a child task. */
function childHistoryItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
	return {
		id: "child-1",
		number: 2,
		ts: Date.now(),
		task: "child task",
		tokensIn: 0,
		tokensOut: 0,
		totalCost: 0,
		status: "active",
		...overrides,
	}
}

/** Helper: minimal HistoryItem for a parent task. */
function parentHistoryItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
	return {
		id: "parent-1",
		number: 1,
		ts: Date.now(),
		task: "parent task",
		tokensIn: 0,
		tokensOut: 0,
		totalCost: 0,
		status: "delegated",
		awaitingChildId: "child-1",
		delegatedToId: "mode-1",
		childIds: ["child-1"],
		completedByChildId: "old-child-0",
		completionResultSummary: "old result summary",
		...overrides,
	}
}

function createMockProvider() {
	return {
		getTaskWithId: vi.fn().mockResolvedValue({ historyItem: parentHistoryItem() }),
		reopenParentFromDelegation: vi.fn().mockResolvedValue(undefined),
		updateTaskHistory: vi.fn().mockResolvedValue([]),
		persistDelegationMeta: vi.fn().mockResolvedValue(undefined),
		readDelegationMeta: vi.fn().mockResolvedValue(null),
	}
}

function createMockTask(provider: ReturnType<typeof createMockProvider>) {
	return {
		taskId: "child-1",
		parentTaskId: "parent-1",
		consecutiveMistakeCount: 0,
		recordToolError: vi.fn(),
		say: vi.fn().mockResolvedValue(undefined),
		ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked", text: undefined, images: undefined }),
		emitFinalTokenUsageUpdate: vi.fn(),
		emit: vi.fn(),
		getTokenUsage: vi.fn().mockReturnValue({}),
		toolUsage: {},
		clineMessages: [],
		providerRef: { deref: () => provider },
		sayAndCreateMissingParamError: vi.fn().mockResolvedValue("missing param"),
	}
}

function createCallbacks(overrides: Record<string, unknown> = {}) {
	return {
		askApproval: vi.fn(),
		handleError: vi.fn(),
		pushToolResult: vi.fn(),
		askFinishSubTaskApproval: vi.fn().mockResolvedValue(true),
		toolDescription: () => "attempt_completion tool",
		...overrides,
	}
}

describe("AttemptCompletionTool delegation and parent-repair", () => {
	let tool: AttemptCompletionTool

	beforeEach(() => {
		tool = new AttemptCompletionTool()
	})

	it("should repair parent to active when delegation attempt fails", async () => {
		const provider = createMockProvider()
		const task = createMockTask(provider)
		const callbacks = createCallbacks()

		// Delegation call fails
		provider.reopenParentFromDelegation.mockRejectedValueOnce(new Error("delegation failure"))

		// First call: child status lookup; second call: parent lookup for repair
		provider.getTaskWithId
			.mockResolvedValueOnce({ historyItem: childHistoryItem() })
			.mockResolvedValueOnce({ historyItem: parentHistoryItem() })

		await tool.execute({ result: "completed work" }, task as any, callbacks as any)

		// Single attempt was made (no retry)
		expect(provider.reopenParentFromDelegation).toHaveBeenCalledTimes(1)

		// Parent was repaired: updateTaskHistory called with status: "active"
		expect(provider.updateTaskHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "parent-1",
				status: "active",
				awaitingChildId: undefined,
				childIds: ["child-1"],
			}),
		)

		// persistDelegationMeta called with status: "active" and null awaitingChildId
		expect(provider.persistDelegationMeta).toHaveBeenCalledWith("parent-1", {
			status: "active",
			awaitingChildId: null,
			delegatedToId: "mode-1",
			childIds: ["child-1"],
			completedByChildId: "old-child-0",
			completionResultSummary: "old result summary",
		})

		// Error tool result was pushed
		expect(callbacks.pushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("Delegation to parent task failed"),
		)
	})

	it("should use read-merge-write disk fallback when parent not in globalState", async () => {
		const provider = createMockProvider()
		const task = createMockTask(provider)
		const callbacks = createCallbacks()

		// Delegation attempt fails
		provider.reopenParentFromDelegation.mockRejectedValueOnce(new Error("delegation failure"))

		// Child status lookup succeeds, parent lookup fails (not in globalState)
		provider.getTaskWithId
			.mockResolvedValueOnce({ historyItem: childHistoryItem() })
			.mockRejectedValueOnce(new Error("Task not found"))

		// Existing delegation meta on disk
		const existingMeta: DelegationMeta = {
			status: "delegated",
			delegatedToId: "mode-1",
			awaitingChildId: "child-1",
			childIds: ["child-1"],
			completedByChildId: "prev-child",
			completionResultSummary: "previous result",
		}
		provider.readDelegationMeta.mockResolvedValue(existingMeta)

		await tool.execute({ result: "completed work" }, task as any, callbacks as any)

		// readDelegationMeta was called for the parent
		expect(provider.readDelegationMeta).toHaveBeenCalledWith("parent-1")

		// persistDelegationMeta preserves existing fields via read-merge-write
		expect(provider.persistDelegationMeta).toHaveBeenCalledWith("parent-1", {
			status: "active",
			awaitingChildId: null,
			delegatedToId: "mode-1",
			childIds: ["child-1"],
			completedByChildId: "prev-child",
			completionResultSummary: "previous result",
		})
	})

	it("should use defaults when disk fallback has no existing meta", async () => {
		const provider = createMockProvider()
		const task = createMockTask(provider)
		const callbacks = createCallbacks()

		// Delegation attempt fails
		provider.reopenParentFromDelegation.mockRejectedValueOnce(new Error("delegation failure"))

		// Child status lookup succeeds, parent lookup fails
		provider.getTaskWithId
			.mockResolvedValueOnce({ historyItem: childHistoryItem() })
			.mockRejectedValueOnce(new Error("Task not found"))

		// No existing delegation meta on disk
		provider.readDelegationMeta.mockResolvedValue(null)

		await tool.execute({ result: "completed work" }, task as any, callbacks as any)

		// persistDelegationMeta uses null defaults when no existing meta
		expect(provider.persistDelegationMeta).toHaveBeenCalledWith("parent-1", {
			status: "active",
			awaitingChildId: null,
			delegatedToId: null,
			childIds: ["child-1"],
			completedByChildId: null,
			completionResultSummary: null,
		})
	})

	it("should not attempt delegation when approval is denied", async () => {
		const provider = createMockProvider()
		const task = createMockTask(provider)
		const callbacks = createCallbacks({
			askFinishSubTaskApproval: vi.fn().mockResolvedValue(false),
		})

		// Child task status is "active"
		provider.getTaskWithId.mockResolvedValue({
			historyItem: childHistoryItem(),
		})

		await tool.execute({ result: "completed work" }, task as any, callbacks as any)

		// No delegation attempted
		expect(provider.reopenParentFromDelegation).not.toHaveBeenCalled()
	})
})
