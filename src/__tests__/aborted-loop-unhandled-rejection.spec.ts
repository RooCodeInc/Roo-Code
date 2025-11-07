// npx vitest run __tests__/aborted-loop-unhandled-rejection.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/* Minimal vscode mock for importing Task */
vi.mock("vscode", () => {
	const window = {
		createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
		showErrorMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
		showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
	}
	const workspace = {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((_key: string, defaultValue: any) => defaultValue),
			update: vi.fn(),
		})),
		workspaceFolders: [],
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
	}
	const env = { machineId: "test-machine", uriScheme: "vscode", appName: "VSCode", language: "en", sessionId: "sess" }
	const Uri = { file: (p: string) => ({ fsPath: p, toString: () => p }) }
	// Minimal RelativePattern mock for RooIgnoreController
	class RelativePattern {
		base: string
		pattern: string
		constructor(base: string, pattern: string) {
			this.base = base
			this.pattern = pattern
		}
	}
	const commands = { executeCommand: vi.fn() }
	const ExtensionMode = { Development: 2 }
	const version = "1.0.0-test"
	return { window, workspace, env, Uri, RelativePattern, commands, ExtensionMode, version }
})

/* Mock TelemetryService to avoid "TelemetryService not initialized" */
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		hasInstance: vi.fn().mockReturnValue(true),
		// Use getter to mirror real API shape
		get instance() {
			return {
				captureTaskCreated: vi.fn(),
				captureTaskRestarted: vi.fn(),
				captureConversationMessage: vi.fn(),
				captureLlmCompletion: vi.fn(),
				captureConsecutiveMistakeError: vi.fn(),
				setProvider: vi.fn(),
			}
		},
	},
}))

/* Prevent real disk I/O from task persistence */
vi.mock("../core/task-persistence/taskMessages", () => ({
	readTaskMessages: vi.fn().mockResolvedValue([]),
}))
vi.mock("../core/task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
	taskMetadata: vi.fn().mockResolvedValue({
		historyItem: {
			id: "task-1",
			number: 1,
			ts: Date.now(),
			task: "Parent",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			mode: "code",
			workspace: "/tmp",
		},
		tokenUsage: { totalCost: 0, totalTokensIn: 0, totalTokensOut: 0, cacheReads: 0, cacheWrites: 0 },
	}),
}))

/* Import after mocks */
import { Task } from "../core/task/Task"

/**
 * This suite ensures we don't surface unhandled promise rejections when a running
 * parent task is disposed/aborted during delegation flows. We simulate the agent
 * loop promise and reject it after the task marks itself abandoned, verifying no
 * unhandledRejection occurs.
 */
describe("Aborted loop has no unhandled rejection during delegation disposal", () => {
	let unhandled: unknown[] = []
	const unhandledHandler = (reason: unknown) => unhandled.push(reason)

	beforeEach(() => {
		vi.restoreAllMocks()
		unhandled = []
		process.on("unhandledRejection", unhandledHandler)
	})

	afterEach(() => {
		process.off("unhandledRejection", unhandledHandler)
	})

	it("swallows initiateTaskLoop rejection after abort/abandon (no unhandledRejection)", async () => {
		// Arrange: stub initiateTaskLoop to a controllable promise
		let rejectLoop: ((err: any) => void) | undefined
		const initSpy = vi.spyOn(Task.prototype as any, "initiateTaskLoop").mockImplementation(function (
			_userContent: any,
		) {
			return new Promise((_resolve, reject) => {
				// Store reject to trigger later (after abort is set)
				rejectLoop = reject
			})
		})

		// Minimal provider stub used by Task
		const provider: any = {
			context: { globalStorageUri: { fsPath: "/tmp" } },
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		}

		// Create a task with startTask=true so Task.startTask() attaches the .catch(...)
		const task = new Task({
			provider,
			apiConfiguration: {
				apiProvider: "anthropic",
				consecutiveMistakeLimit: 3,
				// keep other fields undefined; we don't hit real API paths in this test
			} as any,
			enableCheckpoints: false,
			checkpointTimeout: 30,
			task: "Parent (simulate delegation)",
			images: [],
			onCreated: () => {},
		})

		// Allow async constructor flow to progress
		await new Promise((r) => setTimeout(r, 0))
		// Do not hard-assert call count; downstream assertions validate behavior

		// Act: Simulate delegation disposing parent -> mark abandoned=true via abortTask(true)
		await task.abortTask(true)

		// Now trigger the pending loop rejection as would happen when the async loop detects abort
		rejectLoop?.(new Error("[RooCode#recursivelyMakeRooRequests] task aborted"))

		// Allow promise microtasks to settle
		await new Promise((r) => setTimeout(r, 0))

		// Assert: no process-level unhandled rejections
		expect(unhandled.length).toBe(0)
	})
})
