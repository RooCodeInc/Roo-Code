import { beforeEach, describe, expect, it, vi } from "vitest"
import * as vscode from "vscode"

import { ClineProvider } from "../ClineProvider"
import { Task } from "../../task/Task"
import { ContextProxy } from "../../config/ContextProxy"
import { readDelegationMeta, saveDelegationMeta } from "../../task-persistence/delegationMeta"

// Mock dependencies
vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	return {
		workspace: {
			getConfiguration: vi.fn(() => ({
				get: vi.fn().mockReturnValue([]),
				update: vi.fn().mockResolvedValue(undefined),
			})),
			workspaceFolders: [],
			onDidChangeConfiguration: vi.fn(() => mockDisposable),
		},
		env: {
			uriScheme: "vscode",
			language: "en",
		},
		EventEmitter: vi.fn().mockImplementation(() => ({
			event: vi.fn(),
			fire: vi.fn(),
		})),
		Disposable: {
			from: vi.fn(),
		},
		window: {
			showErrorMessage: vi.fn(),
			createTextEditorDecorationType: vi.fn().mockReturnValue({
				dispose: vi.fn(),
			}),
			onDidChangeActiveTextEditor: vi.fn(() => mockDisposable),
		},
		Uri: {
			file: vi.fn().mockReturnValue({ toString: () => "file://test" }),
		},
	}
})

vi.mock("../../task/Task")
vi.mock("../../config/ContextProxy")
vi.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue({
			registerClient: vi.fn(),
		}),
		unregisterProvider: vi.fn(),
	},
}))
vi.mock("../../../services/marketplace")
vi.mock("../../../integrations/workspace/WorkspaceTracker")
vi.mock("../../config/ProviderSettingsManager")
vi.mock("../../config/CustomModesManager")
vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test/workspace"),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			setProvider: vi.fn(),
			captureTaskCreated: vi.fn(),
		},
	},
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
		instance: {
			isAuthenticated: vi.fn().mockReturnValue(false),
		},
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://api.roo-code.com"),
}))

vi.mock("../../../shared/embeddingModels", () => ({
	EMBEDDING_MODEL_PROFILES: [],
}))

vi.mock("../../task-persistence/delegationMeta", () => ({
	readDelegationMeta: vi.fn(),
	saveDelegationMeta: vi.fn(),
}))

describe("removeClineFromStack — disk fallback delegation repair", () => {
	let provider: ClineProvider
	let mockContext: any
	let mockOutputChannel: any

	const parentTaskId = "parent-task-100"
	const childTaskId = "child-task-200"

	beforeEach(() => {
		vi.clearAllMocks()

		mockContext = {
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			globalStorageUri: { fsPath: "/test/storage" },
			secrets: {
				get: vi.fn().mockResolvedValue(undefined),
				store: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			},
			workspaceState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			extensionUri: { fsPath: "/test/extension" },
		}

		mockOutputChannel = {
			appendLine: vi.fn(),
			dispose: vi.fn(),
		}

		const mockContextProxy = {
			getValues: vi.fn().mockReturnValue({}),
			getValue: vi.fn().mockReturnValue(undefined),
			setValue: vi.fn().mockResolvedValue(undefined),
			getProviderSettings: vi.fn().mockReturnValue({ apiProvider: "anthropic" }),
			extensionUri: mockContext.extensionUri,
			globalStorageUri: mockContext.globalStorageUri,
		}

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", mockContextProxy as any)

		provider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		provider.postStateToWebviewWithoutTaskHistory = vi.fn().mockResolvedValue(undefined)
	})

	it("repairs parent via disk fallback when parent not in globalState", async () => {
		// Mock getTaskWithId to throw "Task not found" (parent missing from globalState)
		provider.getTaskWithId = vi.fn().mockRejectedValue(new Error("Task not found"))

		// Mock disk read to return delegated metadata matching the child
		vi.mocked(readDelegationMeta).mockResolvedValue({
			status: "delegated",
			awaitingChildId: childTaskId,
			delegatedToId: null,
			childIds: [childTaskId],
		})

		vi.mocked(saveDelegationMeta).mockResolvedValue(undefined)

		// Create a mock task that has parentTaskId
		const mockChild: any = {
			taskId: childTaskId,
			instanceId: "inst-1",
			parentTaskId,
			emit: vi.fn(),
			abortTask: vi.fn().mockResolvedValue(undefined),
		}

		// Place the child task on the stack
		;(provider as any).clineStack = [mockChild]

		await provider.removeClineFromStack()

		// Verify saveDelegationMeta was called with repaired status
		expect(saveDelegationMeta).toHaveBeenCalledWith({
			taskId: parentTaskId,
			globalStoragePath: "/test/storage",
			meta: {
				status: "active",
				awaitingChildId: null,
				delegatedToId: null,
				childIds: [childTaskId],
			},
		})
	})

	it("handles graceful failure when both globalState and disk fallback fail", async () => {
		// Mock getTaskWithId to throw "Task not found"
		provider.getTaskWithId = vi.fn().mockRejectedValue(new Error("Task not found"))

		// Mock disk read to also throw
		vi.mocked(readDelegationMeta).mockRejectedValue(new Error("ENOENT: file not found"))

		// Create a mock task with parentTaskId
		const mockChild: any = {
			taskId: childTaskId,
			instanceId: "inst-2",
			parentTaskId,
			emit: vi.fn(),
			abortTask: vi.fn().mockResolvedValue(undefined),
		}

		;(provider as any).clineStack = [mockChild]

		// Should NOT throw — failure is non-fatal
		await expect(provider.removeClineFromStack()).resolves.toBeUndefined()

		// saveDelegationMeta should NOT have been called since readDelegationMeta failed
		expect(saveDelegationMeta).not.toHaveBeenCalled()
	})
})
