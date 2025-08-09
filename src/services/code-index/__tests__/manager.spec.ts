import { CodeIndexManager } from "../manager"
import { CodeIndexServiceFactory } from "../service-factory"
import type { MockedClass } from "vitest"
import * as path from "path"
import * as fs from "fs/promises"
import ignore from "ignore"

// Mock fs/promises module
vi.mock("fs/promises")

// Mock ignore module
vi.mock("ignore")

// Mock vscode module
vi.mock("vscode", () => {
	const testPath = require("path")
	const testWorkspacePath = testPath.join(testPath.sep, "test", "workspace")
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
		},
	}
})

// Mock only the essential dependencies
vi.mock("../../../utils/path", () => {
	const testPath = require("path")
	const testWorkspacePath = testPath.join(testPath.sep, "test", "workspace")
	return {
		getWorkspacePath: vi.fn(() => testWorkspacePath),
	}
})

vi.mock("../state-manager", () => ({
	CodeIndexStateManager: vi.fn().mockImplementation(() => ({
		onProgressUpdate: vi.fn(),
		getCurrentStatus: vi.fn(),
		dispose: vi.fn(),
		setSystemState: vi.fn(),
	})),
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

vi.mock("../service-factory")
const MockedCodeIndexServiceFactory = CodeIndexServiceFactory as MockedClass<typeof CodeIndexServiceFactory>

describe("CodeIndexManager - handleSettingsChange regression", () => {
	let mockContext: any
	let manager: CodeIndexManager

	// Define test paths for use in tests
	const testWorkspacePath = path.join(path.sep, "test", "workspace")
	const testExtensionPath = path.join(path.sep, "test", "extension")
	const testStoragePath = path.join(path.sep, "test", "storage")
	const testGlobalStoragePath = path.join(path.sep, "test", "global-storage")
	const testLogPath = path.join(path.sep, "test", "log")

	beforeEach(() => {
		// Clear all instances before each test
		CodeIndexManager.disposeAll()

		mockContext = {
			subscriptions: [],
			workspaceState: {} as any,
			globalState: {} as any,
			extensionUri: {} as any,
			extensionPath: testExtensionPath,
			asAbsolutePath: vi.fn(),
			storageUri: {} as any,
			storagePath: testStoragePath,
			globalStorageUri: {} as any,
			globalStoragePath: testGlobalStoragePath,
			logUri: {} as any,
			logPath: testLogPath,
			extensionMode: 3, // vscode.ExtensionMode.Test
			secrets: {} as any,
			environmentVariableCollection: {} as any,
			extension: {} as any,
			languageModelAccessInformation: {} as any,
		}

		manager = CodeIndexManager.getInstance(mockContext)!
	})

	afterEach(() => {
		CodeIndexManager.disposeAll()
	})

	describe("handleSettingsChange", () => {
		it("should not throw when called on uninitialized manager (regression test)", async () => {
			// This is the core regression test: handleSettingsChange() should not throw
			// when called before the manager is initialized (during first-time configuration)

			// Ensure manager is not initialized
			expect(manager.isInitialized).toBe(false)

			// Mock a minimal config manager that simulates first-time configuration
			const mockConfigManager = {
				loadConfiguration: vi.fn().mockResolvedValue({ requiresRestart: true }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock cache manager
			const mockCacheManager = {
				initialize: vi.fn(),
				clearCacheFile: vi.fn(),
			}
			;(manager as any)._cacheManager = mockCacheManager

			// Mock the feature state to simulate valid configuration that would normally trigger restart
			vi.spyOn(manager, "isFeatureEnabled", "get").mockReturnValue(true)
			vi.spyOn(manager, "isFeatureConfigured", "get").mockReturnValue(true)

			// Mock service factory to handle _recreateServices call
			const mockServiceFactoryInstance = {
				configManager: mockConfigManager,
				workspacePath: testWorkspacePath,
				cacheManager: mockCacheManager,
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue({}),
				createDirectoryScanner: vi.fn().mockReturnValue({}),
				createFileWatcher: vi.fn().mockReturnValue({
					onDidStartBatchProcessing: vi.fn(),
					onBatchProgressUpdate: vi.fn(),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				}),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: {},
					scanner: {},
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn(),
						onBatchProgressUpdate: vi.fn(),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			// The key test: this should NOT throw "CodeIndexManager not initialized" error
			await expect(manager.handleSettingsChange()).resolves.not.toThrow()

			// Verify that loadConfiguration was called (the method should still work)
			expect(mockConfigManager.loadConfiguration).toHaveBeenCalled()
		})

		it("should work normally when manager is initialized", async () => {
			// Mock a complete config manager with all required properties
			const mockConfigManager = {
				loadConfiguration: vi.fn().mockResolvedValue({ requiresRestart: true }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock cache manager
			const mockCacheManager = {
				initialize: vi.fn(),
				clearCacheFile: vi.fn(),
			}
			;(manager as any)._cacheManager = mockCacheManager

			// Simulate an initialized manager by setting the required properties
			;(manager as any)._orchestrator = { stopWatcher: vi.fn() }
			;(manager as any)._searchService = {}

			// Verify manager is considered initialized
			expect(manager.isInitialized).toBe(true)

			// Mock the feature state
			vi.spyOn(manager, "isFeatureEnabled", "get").mockReturnValue(true)
			vi.spyOn(manager, "isFeatureConfigured", "get").mockReturnValue(true)

			// Mock service factory to handle _recreateServices call
			const mockServiceFactoryInstance = {
				configManager: mockConfigManager,
				workspacePath: testWorkspacePath,
				cacheManager: mockCacheManager,
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue({}),
				createDirectoryScanner: vi.fn().mockReturnValue({}),
				createFileWatcher: vi.fn().mockReturnValue({
					onDidStartBatchProcessing: vi.fn(),
					onBatchProgressUpdate: vi.fn(),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				}),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: {},
					scanner: {},
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn(),
						onBatchProgressUpdate: vi.fn(),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			// Mock the methods that would be called during restart
			const recreateServicesSpy = vi.spyOn(manager as any, "_recreateServices")

			await manager.handleSettingsChange()

			// Verify that the restart sequence was called
			expect(mockConfigManager.loadConfiguration).toHaveBeenCalled()
			// _recreateServices should be called when requiresRestart is true
			expect(recreateServicesSpy).toHaveBeenCalled()
			// Note: startIndexing is NOT called by handleSettingsChange - it's only called by initialize()
		})

		it("should handle case when config manager is not set", async () => {
			// Ensure config manager is not set (edge case)
			;(manager as any)._configManager = undefined

			// This should not throw an error
			await expect(manager.handleSettingsChange()).resolves.not.toThrow()
		})
	})

	describe("embedder validation integration", () => {
		let mockServiceFactoryInstance: any
		let mockStateManager: any
		let mockEmbedder: any
		let mockVectorStore: any
		let mockScanner: any
		let mockFileWatcher: any

		beforeEach(() => {
			// Mock service factory objects
			mockEmbedder = { embedderInfo: { name: "openai" } }
			mockVectorStore = {}
			mockScanner = {}
			mockFileWatcher = {
				onDidStartBatchProcessing: vi.fn(),
				onBatchProgressUpdate: vi.fn(),
				watch: vi.fn(),
				stopWatcher: vi.fn(),
				dispose: vi.fn(),
			}

			// Mock service factory instance
			mockServiceFactoryInstance = {
				createServices: vi.fn().mockReturnValue({
					embedder: mockEmbedder,
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					fileWatcher: mockFileWatcher,
				}),
				validateEmbedder: vi.fn(),
			}

			// Mock the ServiceFactory constructor
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance)

			// Mock state manager methods directly on the existing instance
			mockStateManager = (manager as any)._stateManager
			mockStateManager.setSystemState = vi.fn()

			// Mock config manager
			const mockConfigManager = {
				loadConfiguration: vitest.fn().mockResolvedValue({ requiresRestart: false }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vitest.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager
		})

		it("should validate embedder during _recreateServices when validation succeeds", async () => {
			// Arrange
			mockServiceFactoryInstance.validateEmbedder.mockResolvedValue({ valid: true })

			// Act - directly call the private method for testing
			await (manager as any)._recreateServices()

			// Assert
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()
			const createdEmbedder = mockServiceFactoryInstance.createServices.mock.results[0].value.embedder
			expect(mockServiceFactoryInstance.validateEmbedder).toHaveBeenCalledWith(createdEmbedder)
			expect(mockStateManager.setSystemState).not.toHaveBeenCalledWith("Error", expect.any(String))
		})

		it("should set error state when embedder validation fails", async () => {
			// Arrange
			mockServiceFactoryInstance.validateEmbedder.mockResolvedValue({
				valid: false,
				error: "embeddings:validation.authenticationFailed",
			})

			// Act & Assert
			await expect((manager as any)._recreateServices()).rejects.toThrow(
				"embeddings:validation.authenticationFailed",
			)

			// Assert other expectations
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()
			const createdEmbedder = mockServiceFactoryInstance.createServices.mock.results[0].value.embedder
			expect(mockServiceFactoryInstance.validateEmbedder).toHaveBeenCalledWith(createdEmbedder)
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Error",
				"embeddings:validation.authenticationFailed",
			)
		})

		it("should set generic error state when embedder validation throws", async () => {
			// Arrange
			// Since the real service factory catches exceptions, we should mock it to resolve with an error
			mockServiceFactoryInstance.validateEmbedder.mockResolvedValue({
				valid: false,
				error: "embeddings:validation.configurationError",
			})

			// Act & Assert
			await expect((manager as any)._recreateServices()).rejects.toThrow(
				"embeddings:validation.configurationError",
			)

			// Assert other expectations
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()
			const createdEmbedder = mockServiceFactoryInstance.createServices.mock.results[0].value.embedder
			expect(mockServiceFactoryInstance.validateEmbedder).toHaveBeenCalledWith(createdEmbedder)
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Error",
				"embeddings:validation.configurationError",
			)
		})

		it("should handle embedder creation failure", async () => {
			// Arrange
			mockServiceFactoryInstance.createServices.mockImplementation(() => {
				throw new Error("Invalid configuration")
			})

			// Act & Assert - should throw the error
			await expect((manager as any)._recreateServices()).rejects.toThrow("Invalid configuration")

			// Should not attempt validation if embedder creation fails
			expect(mockServiceFactoryInstance.validateEmbedder).not.toHaveBeenCalled()
		})
	})

	describe("recoverFromError", () => {
		let mockConfigManager: any
		let mockCacheManager: any
		let mockStateManager: any

		beforeEach(() => {
			// Mock config manager
			mockConfigManager = {
				loadConfiguration: vi.fn().mockResolvedValue({ requiresRestart: false }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock cache manager
			mockCacheManager = {
				initialize: vi.fn(),
				clearCacheFile: vi.fn(),
			}
			;(manager as any)._cacheManager = mockCacheManager

			// Mock state manager
			mockStateManager = (manager as any)._stateManager
			mockStateManager.setSystemState = vi.fn()
			mockStateManager.getCurrentStatus = vi.fn().mockReturnValue({
				systemStatus: "Error",
				message: "Failed during initial scan: fetch failed",
				processedItems: 0,
				totalItems: 0,
				currentItemUnit: "items",
			})

			// Mock orchestrator and search service to simulate initialized state
			;(manager as any)._orchestrator = { stopWatcher: vi.fn(), state: "Error" }
			;(manager as any)._searchService = {}
			;(manager as any)._serviceFactory = {}
		})

		it("should clear error state when recoverFromError is called", async () => {
			// Act
			await manager.recoverFromError()

			// Assert
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith("Standby", "")
		})

		it("should reset internal service instances", async () => {
			// Verify initial state
			expect((manager as any)._configManager).toBeDefined()
			expect((manager as any)._serviceFactory).toBeDefined()
			expect((manager as any)._orchestrator).toBeDefined()
			expect((manager as any)._searchService).toBeDefined()

			// Act
			await manager.recoverFromError()

			// Assert - all service instances should be undefined
			expect((manager as any)._configManager).toBeUndefined()
			expect((manager as any)._serviceFactory).toBeUndefined()
			expect((manager as any)._orchestrator).toBeUndefined()
			expect((manager as any)._searchService).toBeUndefined()
		})

		it("should make manager report as not initialized after recovery", async () => {
			// Verify initial state
			expect(manager.isInitialized).toBe(true)

			// Act
			await manager.recoverFromError()

			// Assert
			expect(manager.isInitialized).toBe(false)
		})

		it("should allow re-initialization after recovery", async () => {
			// Setup mock for re-initialization
			const mockServiceFactoryInstance = {
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: {},
					scanner: {},
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn(),
						onBatchProgressUpdate: vi.fn(),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			// Act - recover from error
			await manager.recoverFromError()

			// Verify manager is not initialized
			expect(manager.isInitialized).toBe(false)

			// Mock context proxy for initialization
			const mockContextProxy = {
				getValue: vi.fn(),
				setValue: vi.fn(),
				storeSecret: vi.fn(),
				getSecret: vi.fn(),
				refreshSecrets: vi.fn().mockResolvedValue(undefined),
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: true,
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderProvider: "openai",
					codebaseIndexEmbedderModelId: "text-embedding-3-small",
					codebaseIndexEmbedderModelDimension: 1536,
					codebaseIndexSearchMaxResults: 10,
					codebaseIndexSearchMinScore: 0.4,
				}),
			}

			// Re-initialize
			await manager.initialize(mockContextProxy as any)

			// Assert - manager should be initialized again
			expect(manager.isInitialized).toBe(true)
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()
			expect(mockServiceFactoryInstance.validateEmbedder).toHaveBeenCalled()
		})

		it("should be safe to call when not in error state (idempotent)", async () => {
			// Setup manager in non-error state
			mockStateManager.getCurrentStatus.mockReturnValue({
				systemStatus: "Standby",
				message: "",
				processedItems: 0,
				totalItems: 0,
				currentItemUnit: "items",
			})

			// Verify initial state is not error
			const initialStatus = manager.getCurrentStatus()
			expect(initialStatus.systemStatus).not.toBe("Error")

			// Act - call recoverFromError when not in error state
			await expect(manager.recoverFromError()).resolves.not.toThrow()

			// Assert - should still clear state and service instances
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith("Standby", "")
			expect((manager as any)._configManager).toBeUndefined()
			expect((manager as any)._serviceFactory).toBeUndefined()
			expect((manager as any)._orchestrator).toBeUndefined()
			expect((manager as any)._searchService).toBeUndefined()
		})

		it("should continue recovery even if setSystemState throws", async () => {
			// Setup state manager to throw on setSystemState
			mockStateManager.setSystemState.mockImplementation(() => {
				throw new Error("State update failed")
			})

			// Setup manager with service instances
			;(manager as any)._configManager = mockConfigManager
			;(manager as any)._serviceFactory = {}
			;(manager as any)._orchestrator = { stopWatcher: vi.fn() }
			;(manager as any)._searchService = {}

			// Spy on console.error
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act - should not throw despite setSystemState error
			await expect(manager.recoverFromError()).resolves.not.toThrow()

			// Assert - error should be logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to clear error state during recovery:",
				expect.any(Error),
			)

			// Assert - service instances should still be cleared
			expect((manager as any)._configManager).toBeUndefined()
			expect((manager as any)._serviceFactory).toBeUndefined()
			expect((manager as any)._orchestrator).toBeUndefined()
			expect((manager as any)._searchService).toBeUndefined()

			// Cleanup
			consoleErrorSpy.mockRestore()
		})
	})

	describe("gitignore pattern handling", () => {
		let mockIgnoreInstance: any
		let mockConfigManager: any
		let mockCacheManager: any
		let mockServiceFactoryInstance: any

		beforeEach(() => {
			// Reset mocks
			vi.clearAllMocks()

			// Mock ignore instance
			mockIgnoreInstance = {
				add: vi.fn(),
				ignores: vi.fn(() => false),
			}

			// Mock the ignore module to return our mock instance
			vi.mocked(ignore).mockReturnValue(mockIgnoreInstance)

			// Mock config manager
			mockConfigManager = {
				loadConfiguration: vi.fn().mockResolvedValue({ requiresRestart: false }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock cache manager
			mockCacheManager = {
				initialize: vi.fn(),
				clearCacheFile: vi.fn(),
			}
			;(manager as any)._cacheManager = mockCacheManager

			// Mock service factory
			mockServiceFactoryInstance = {
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: {},
					scanner: {},
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn(),
						onBatchProgressUpdate: vi.fn(),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)
		})

		it("should handle invalid gitignore patterns gracefully", async () => {
			// Arrange - Mock .gitignore with invalid pattern
			const invalidGitignoreContent = `
# Valid patterns
node_modules/
*.log

# Invalid pattern - character range out of order
pqh[A-/]

# More valid patterns
dist/
.env
`
			;(fs.readFile as any).mockResolvedValue(invalidGitignoreContent)

			// Make the first add() call throw an error (simulating invalid pattern)
			let addCallCount = 0
			mockIgnoreInstance.add.mockImplementation((pattern: string) => {
				addCallCount++
				// Throw on first call (full content), succeed on individual patterns
				if (addCallCount === 1) {
					throw new Error(
						"Invalid regular expression: /^pqh[A-\\/](?=$|\\/$)/i: Range out of order in character class",
					)
				}
				// Throw on the specific invalid pattern
				if (pattern.includes("pqh[A-/]")) {
					throw new Error(
						"Invalid regular expression: /^pqh[A-\\/](?=$|\\/$)/i: Range out of order in character class",
					)
				}
			})

			// Spy on console methods
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await (manager as any)._recreateServices()

			// Assert - Should have logged warnings
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Warning: .gitignore contains invalid patterns"),
			)
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Skipping invalid .gitignore pattern: "pqh[A-/]"'),
			)

			// Should have attempted to add valid patterns individually
			expect(mockIgnoreInstance.add).toHaveBeenCalled()

			// Should not throw an error - service creation should continue
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()
			expect(mockServiceFactoryInstance.validateEmbedder).toHaveBeenCalled()

			// Cleanup
			consoleWarnSpy.mockRestore()
		})

		it("should process valid gitignore patterns normally", async () => {
			// Arrange - Mock .gitignore with all valid patterns
			const validGitignoreContent = `
# Valid patterns
node_modules/
*.log
dist/
.env
`
			;(fs.readFile as any).mockResolvedValue(validGitignoreContent)

			// All add() calls succeed
			mockIgnoreInstance.add.mockImplementation(() => {})

			// Spy on console methods
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await (manager as any)._recreateServices()

			// Assert - Should not have logged any warnings
			expect(consoleWarnSpy).not.toHaveBeenCalled()

			// Should have added the content and .gitignore itself
			expect(mockIgnoreInstance.add).toHaveBeenCalledWith(validGitignoreContent)
			expect(mockIgnoreInstance.add).toHaveBeenCalledWith(".gitignore")

			// Service creation should proceed normally
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()
			expect(mockServiceFactoryInstance.validateEmbedder).toHaveBeenCalled()

			// Cleanup
			consoleWarnSpy.mockRestore()
		})

		it("should handle missing .gitignore file gracefully", async () => {
			// Arrange - Mock file not found error
			;(fs.readFile as any).mockRejectedValue(new Error("ENOENT: no such file or directory"))

			// Spy on console methods
			const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {})

			// Act
			await (manager as any)._recreateServices()

			// Assert - Should log info message
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				".gitignore file not found or could not be read, proceeding without gitignore patterns",
			)

			// Should not attempt to add patterns
			expect(mockIgnoreInstance.add).not.toHaveBeenCalled()

			// Service creation should proceed normally
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()
			expect(mockServiceFactoryInstance.validateEmbedder).toHaveBeenCalled()

			// Cleanup
			consoleInfoSpy.mockRestore()
		})

		it("should handle mixed valid and invalid patterns", async () => {
			// Arrange - Mock .gitignore with mix of valid and invalid patterns
			const mixedGitignoreContent = `
node_modules/
pqh[A-/]
*.log
[Z-A]invalid
dist/
`
			;(fs.readFile as any).mockResolvedValue(mixedGitignoreContent)

			// Make add() throw on invalid patterns
			mockIgnoreInstance.add.mockImplementation((pattern: string) => {
				if (pattern === mixedGitignoreContent) {
					throw new Error("Invalid patterns detected")
				}
				if (pattern.includes("[A-/]") || pattern.includes("[Z-A]")) {
					throw new Error("Invalid character range")
				}
			})

			// Spy on console methods
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await (manager as any)._recreateServices()

			// Assert - Should have logged warnings for invalid patterns
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Warning: .gitignore contains invalid patterns"),
			)
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Skipping invalid .gitignore pattern: "pqh[A-/]"'),
			)
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Skipping invalid .gitignore pattern: "[Z-A]invalid"'),
			)

			// Should have attempted to add valid patterns
			expect(mockIgnoreInstance.add).toHaveBeenCalledWith("node_modules/")
			expect(mockIgnoreInstance.add).toHaveBeenCalledWith("*.log")
			expect(mockIgnoreInstance.add).toHaveBeenCalledWith("dist/")
			expect(mockIgnoreInstance.add).toHaveBeenCalledWith(".gitignore")

			// Service creation should proceed normally
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()
			expect(mockServiceFactoryInstance.validateEmbedder).toHaveBeenCalled()

			// Cleanup
			consoleWarnSpy.mockRestore()
		})
	})
})
