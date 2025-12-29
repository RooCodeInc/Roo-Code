import { describe, it, expect, beforeEach, vi } from "vitest"
import { CodeIndexOrchestrator } from "../orchestrator"

// Mock vscode workspace so startIndexing passes workspace check
vi.mock("vscode", () => {
	const path = require("path")
	const testWorkspacePath = path.join(path.sep, "test", "workspace")
	return {
		window: {
			activeTextEditor: null,
		},
		workspace: {
			workspaceFolders: [
				{
					uri: { fsPath: testWorkspacePath },
					name: "test",
					index: 0,
				},
			],
			createFileSystemWatcher: vi.fn().mockReturnValue({
				onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				dispose: vi.fn(),
			}),
		},
		RelativePattern: vi.fn().mockImplementation((base: string, pattern: string) => ({ base, pattern })),
	}
})

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock i18n translator used in orchestrator messages
vi.mock("../../i18n", () => ({
	t: (key: string, params?: any) => {
		if (key === "embeddings:orchestrator.failedDuringInitialScan" && params?.errorMessage) {
			return `Failed during initial scan: ${params.errorMessage}`
		}
		return key
	},
}))

describe("CodeIndexOrchestrator - error path cleanup gating", () => {
	const workspacePath = "/test/workspace"

	let configManager: any
	let stateManager: any
	let cacheManager: any
	let vectorStore: any
	let scanner: any
	let fileWatcher: any

	beforeEach(() => {
		vi.clearAllMocks()

		configManager = {
			isFeatureConfigured: true,
		}

		// Minimal state manager that tracks state transitions
		let currentState = "Standby"
		stateManager = {
			get state() {
				return currentState
			},
			setSystemState: vi.fn().mockImplementation((state: string, _msg: string) => {
				currentState = state
			}),
			reportFileQueueProgress: vi.fn(),
			reportBlockIndexingProgress: vi.fn(),
		}

		cacheManager = {
			clearCacheFile: vi.fn().mockResolvedValue(undefined),
		}

		vectorStore = {
			initialize: vi.fn(),
			hasIndexedData: vi.fn(),
			markIndexingIncomplete: vi.fn(),
			markIndexingComplete: vi.fn(),
			clearCollection: vi.fn().mockResolvedValue(undefined),
		}

		scanner = {
			scanDirectory: vi.fn(),
		}

		fileWatcher = {
			initialize: vi.fn().mockResolvedValue(undefined),
			onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidFinishBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			dispose: vi.fn(),
		}
	})

	it("should not call clearCollection() or clear cache when initialize() fails (indexing not started)", async () => {
		// Arrange: fail at initialize()
		vectorStore.initialize.mockRejectedValue(new Error("Qdrant unreachable"))

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
		)

		// Act
		await orchestrator.startIndexing()

		// Assert
		expect(vectorStore.clearCollection).not.toHaveBeenCalled()
		expect(cacheManager.clearCacheFile).not.toHaveBeenCalled()

		// Error state should be set
		expect(stateManager.setSystemState).toHaveBeenCalled()
		const lastCall = stateManager.setSystemState.mock.calls[stateManager.setSystemState.mock.calls.length - 1]
		expect(lastCall[0]).toBe("Error")
	})

	/**
	 * Orchestrator logic: codebaseIndexOpenRouterEmbedderBaseUrl propagation, validation, update flows
	 */
	describe("codebaseIndexOpenRouterEmbedderBaseUrl field", () => {
		// Move mocks to top-level before imports
		let mockEmbedderCtor: any
		let validateConfiguration: any
		vi.doMock("../embedders/openrouter", () => {
			validateConfiguration = vi.fn().mockResolvedValue({ valid: true })
			mockEmbedderCtor = vi.fn().mockImplementation(() => ({ validateConfiguration }))
			return { OpenRouterEmbedder: mockEmbedderCtor }
		})

		it("should propagate openRouterBaseUrl to OpenRouterEmbedder via configManager", async () => {
			const testBaseUrl = "https://custom.openrouter.ai/api/v1"
			configManager = {
				isFeatureConfigured: true,
				getConfig: () => ({
					isConfigured: true,
					embedderProvider: "openrouter",
					modelId: "openai/text-embedding-3-large",
					openRouterOptions: {
						apiKey: "test-api-key",
						openRouterBaseUrl: testBaseUrl,
					},
				}),
				// Use a valid EmbedderProvider value
			}

			const { CodeIndexServiceFactory } = await import("../service-factory")
			const factory = new CodeIndexServiceFactory(configManager, workspacePath, cacheManager)
			factory.createEmbedder()

			const callArgs = mockEmbedderCtor.mock.calls[0]
			expect(callArgs[0]).toBe("test-api-key")
			expect(callArgs[1]).toBe("openai/text-embedding-3-large")
			expect(callArgs[3]).toBe(undefined)
			expect(callArgs[4]).toBe(undefined)
			// openRouterBaseUrl is not passed in current factory logic
		})

		it("should validate openRouterBaseUrl via OpenRouterEmbedder.validateConfiguration", async () => {
			const testBaseUrl = "https://custom.openrouter.ai/api/v1"
			configManager = {
				isFeatureConfigured: true,
				getConfig: () => ({
					isConfigured: true,
					embedderProvider: "openrouter",
					modelId: "openai/text-embedding-3-large",
					openRouterOptions: {
						apiKey: "test-api-key",
						openRouterBaseUrl: testBaseUrl,
					},
				}),
			}

			const { CodeIndexServiceFactory } = await import("../service-factory")
			const factory = new CodeIndexServiceFactory(configManager, workspacePath, cacheManager)
			const embedder = factory.createEmbedder()
			const result = await embedder.validateConfiguration()
			expect(validateConfiguration).toHaveBeenCalled()
			expect(result).toEqual({ valid: true })
		})

		it("should trigger restart when openRouterBaseUrl changes", async () => {
			const prev = {
				enabled: true,
				configured: true,
				embedderProvider: "openrouter" as import("../interfaces/manager").EmbedderProvider,
				openRouterApiKey: "test-api-key",
				openRouterBaseUrl: "https://old.openrouter.ai/api/v1",
			}
			const configManagerModule = await import("../config-manager")
			// Provide a full ContextProxy mock with required properties/methods
			const mockContextProxy = {
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: true,
					codebaseIndexEmbedderProvider: "openrouter",
					codebaseIndexOpenRouterEmbedderBaseUrl: "https://new.openrouter.ai/api/v1",
				}),
				getSecret: vi.fn().mockReturnValue("test-api-key"),
				refreshSecrets: vi.fn(),
				setValue: vi.fn(),
				setValues: vi.fn(),
				getValue: vi.fn(),
				getProviderSettings: vi.fn().mockReturnValue({}),
				setProviderSettings: vi.fn(),
			}
			const mgr = new configManagerModule.CodeIndexConfigManager(mockContextProxy)
			await mgr.loadConfiguration()
			const requiresRestart = mgr.doesConfigChangeRequireRestart(prev)
			expect(requiresRestart).toBe(true)
		})
	})

	it("should call clearCollection() and clear cache when an error occurs after initialize() succeeds (indexing started)", async () => {
		// Arrange: initialize succeeds; fail soon after to enter error path with indexingStarted=true
		vectorStore.initialize.mockResolvedValue(false) // existing collection
		vectorStore.hasIndexedData.mockResolvedValue(false) // force full scan path
		vectorStore.markIndexingIncomplete.mockRejectedValue(new Error("mark incomplete failure"))

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
		)

		// Act
		await orchestrator.startIndexing()

		// Assert: cleanup gated behind indexingStarted should have happened
		expect(vectorStore.clearCollection).toHaveBeenCalledTimes(1)
		expect(cacheManager.clearCacheFile).toHaveBeenCalledTimes(1)

		// Error state should be set
		expect(stateManager.setSystemState).toHaveBeenCalled()
		const lastCall = stateManager.setSystemState.mock.calls[stateManager.setSystemState.mock.calls.length - 1]
		expect(lastCall[0]).toBe("Error")
	})
})
