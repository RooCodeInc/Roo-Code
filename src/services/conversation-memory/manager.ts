import * as vscode from "vscode"
import { createHash } from "crypto"
import { ContextProxy } from "../../core/config/ContextProxy"
import {
	ConversationFact,
	ConversationEpisode,
	Message,
	MemoryStatus,
	MemorySearchOptions,
	ProjectContext,
} from "./interfaces"
import { ConversationMemoryConfigManager } from "./config-manager"
import { ConversationMemoryStateManager } from "./state-manager"
import { ConversationMemoryServiceFactory } from "./service-factory"
import { ConversationMemoryOrchestrator } from "./orchestrator"
import { ConversationMemorySearchService } from "./search-service"
import { ConversationMemoryCacheManager } from "./cache-manager"
import path from "path"
import fs from "fs/promises"

export class ConversationMemoryManager {
	// --- Singleton Implementation (mirrors CodeIndexManager) ---
	private static instances = new Map<string, ConversationMemoryManager>()

	// Service dependencies - following CodeIndex patterns
	private _configManager: ConversationMemoryConfigManager | undefined
	private readonly _stateManager: ConversationMemoryStateManager
	private _serviceFactory: ConversationMemoryServiceFactory | undefined
	private _orchestrator: ConversationMemoryOrchestrator | undefined
	private _searchService: ConversationMemorySearchService | undefined
	private _cacheManager: ConversationMemoryCacheManager | undefined

	// Project context for this workspace
	private _projectContext: ProjectContext | undefined

	// Flag to prevent race conditions during error recovery
	private _isRecoveringFromError = false

	public static getInstance(
		context: vscode.ExtensionContext,
		workspacePath?: string,
	): ConversationMemoryManager | undefined {
		// Exact same workspace discovery logic as CodeIndexManager
		if (!workspacePath) {
			const activeEditor = vscode.window.activeTextEditor
			if (activeEditor) {
				const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
				workspacePath = workspaceFolder?.uri.fsPath
			}

			if (!workspacePath) {
				const workspaceFolders = vscode.workspace.workspaceFolders
				if (!workspaceFolders || workspaceFolders.length === 0) {
					return undefined
				}
				workspacePath = workspaceFolders[0].uri.fsPath
			}
		}

		if (!ConversationMemoryManager.instances.has(workspacePath)) {
			ConversationMemoryManager.instances.set(
				workspacePath,
				new ConversationMemoryManager(workspacePath, context),
			)
		}
		return ConversationMemoryManager.instances.get(workspacePath)!
	}

	public static async initializeAll(context: vscode.ExtensionContext): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders || []

		for (const folder of workspaceFolders) {
			try {
				const manager = ConversationMemoryManager.getInstance(context, folder.uri.fsPath)
				if (manager) {
					const contextProxy = new ContextProxy(context)
					await manager.initialize(contextProxy)
				}
			} catch (error) {
				console.warn(`Memory manager initialization failed for ${folder.uri.fsPath}:`, error)
				// Continue - don't break other workspaces
			}
		}

		// Listen for workspace changes
		vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
			// Handle workspace additions
			for (const added of event.added) {
				try {
					const manager = ConversationMemoryManager.getInstance(context, added.uri.fsPath)
					if (manager) {
						const contextProxy = new ContextProxy(context)
						await manager.initialize(contextProxy)
					}
				} catch (error) {
					console.warn(`Failed to initialize memory manager for ${added.uri.fsPath}:`, error)
				}
			}

			// Handle workspace removals
			for (const removed of event.removed) {
				const manager = ConversationMemoryManager.instances.get(removed.uri.fsPath)
				if (manager) {
					manager.dispose()
					ConversationMemoryManager.instances.delete(removed.uri.fsPath)
				}
			}
		})
	}

	public static getCurrentWorkspaceManager(): ConversationMemoryManager | undefined {
		const activeEditor = vscode.window.activeTextEditor
		if (!activeEditor) return undefined

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
		if (!workspaceFolder) return undefined

		return this.instances.get(workspaceFolder.uri.fsPath)
	}

	public static disposeAll(): void {
		for (const instance of ConversationMemoryManager.instances.values()) {
			instance.dispose()
		}
		ConversationMemoryManager.instances.clear()
	}

	private readonly workspacePath: string
	private readonly context: vscode.ExtensionContext

	// Private constructor for singleton pattern
	private constructor(workspacePath: string, context: vscode.ExtensionContext) {
		this.workspacePath = workspacePath
		this.context = context
		this._stateManager = new ConversationMemoryStateManager()
	}

	// --- Public API ---

	public get onProgressUpdate() {
		return this._stateManager.onProgressUpdate
	}

	private assertInitialized() {
		if (!this._configManager || !this._orchestrator || !this._searchService || !this._cacheManager) {
			throw new Error("ConversationMemoryManager not initialized. Call initialize() first.")
		}
	}

	public get isFeatureEnabled(): boolean {
		return this._configManager?.isFeatureEnabled ?? false
	}

	public get isFeatureConfigured(): boolean {
		return this._configManager?.isFeatureConfigured ?? false
	}

	public get isInitialized(): boolean {
		try {
			this.assertInitialized()
			return true
		} catch (error) {
			return false
		}
	}

	public async initialize(contextProxy: ContextProxy): Promise<{ requiresRestart: boolean }> {
		// 1. ConfigManager Initialization and Configuration Loading
		if (!this._configManager) {
			this._configManager = new ConversationMemoryConfigManager(contextProxy)
		}
		const { requiresRestart } = await this._configManager.loadConfiguration()

		// 2. Check if feature is enabled
		if (!this.isFeatureEnabled) {
			if (this._orchestrator) {
				this._orchestrator.stopProcessing()
			}
			return { requiresRestart }
		}

		// 3. Detect project context
		this._projectContext = await this.detectProjectContext()

		// 4. CacheManager Initialization
		if (!this._cacheManager) {
			this._cacheManager = new ConversationMemoryCacheManager(this.context, this.workspacePath)
			await this._cacheManager.initialize()
		}

		// 5. Determine if Core Services Need Recreation
		const needsServiceRecreation = !this._serviceFactory || requiresRestart

		if (needsServiceRecreation) {
			await this._recreateServices()
		}

		return { requiresRestart }
	}

	public async searchMemory(query: string, options?: MemorySearchOptions): Promise<ConversationFact[]> {
		if (!this.isFeatureEnabled) {
			return []
		}

		try {
			this.assertInitialized()
			return await this._searchService!.searchMemory(query, options)
		} catch (error) {
			console.warn("Memory search failed:", error)
			return []
		}
	}

	public async processConversation(messages: Message[]): Promise<void> {
		if (!this.isFeatureEnabled) {
			return
		}

		try {
			this.assertInitialized()

			const episode: ConversationEpisode = {
				messages,
				reference_time: new Date(),
				workspace_path: this.workspacePath,
				context_description: "Interactive conversation",
			}

			await this._orchestrator!.processConversationEpisode(episode)
		} catch (error) {
			console.warn("Memory processing failed:", error)
			// Never throw - don't break existing flows
		}
	}

	public getCurrentMemoryStatus(): MemoryStatus {
		return this._stateManager.getCurrentStatus()
	}

	public async recoverFromError(): Promise<void> {
		// Prevent race conditions from multiple rapid recovery attempts
		if (this._isRecoveringFromError) {
			return
		}

		this._isRecoveringFromError = true
		try {
			// Clear error state
			this._stateManager.setSystemState("Standby", "")
		} catch (error) {
			console.error("Failed to clear error state during recovery:", error)
		} finally {
			// Force re-initialization by clearing service instances
			this._configManager = undefined
			this._serviceFactory = undefined
			this._orchestrator = undefined
			this._searchService = undefined

			this._isRecoveringFromError = false
		}
	}

	public dispose(): void {
		if (this._orchestrator) {
			this._orchestrator.stopProcessing()
		}
		this._stateManager.dispose()
	}

	public async clearMemoryData(): Promise<void> {
		if (!this.isFeatureEnabled) {
			return
		}
		this.assertInitialized()
		await this._orchestrator!.clearMemoryData()
		await this._cacheManager!.clearCacheFile()
	}

	// --- Private Helpers ---

	private async detectProjectContext(): Promise<ProjectContext> {
		const workspaceFiles = await this.scanWorkspaceFiles()

		let language: ProjectContext["language"] = "unknown"
		let framework: string | undefined
		let packageManager: ProjectContext["packageManager"]

		if (workspaceFiles.includes("package.json")) {
			language = "typescript"
			packageManager = workspaceFiles.includes("yarn.lock")
				? "yarn"
				: workspaceFiles.includes("pnpm-lock.yaml")
					? "pnpm"
					: "npm"

			// Framework detection from package.json
			try {
				const packageJsonPath = path.join(this.workspacePath, "package.json")
				const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"))

				if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
					framework = "react"
				} else if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
					framework = "nextjs"
				} else if (packageJson.dependencies?.express || packageJson.devDependencies?.express) {
					framework = "express"
				} else if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
					framework = "vue"
				}
			} catch (error) {
				// Ignore errors reading package.json
			}
		} else if (workspaceFiles.includes("requirements.txt") || workspaceFiles.includes("pyproject.toml")) {
			language = "python"
			packageManager = "pip"

			// Framework detection
			try {
				const requirementsPath = path.join(this.workspacePath, "requirements.txt")
				const requirements = await fs.readFile(requirementsPath, "utf8")

				if (requirements.includes("django")) framework = "django"
				else if (requirements.includes("fastapi")) framework = "fastapi"
				else if (requirements.includes("flask")) framework = "flask"
				else if (requirements.includes("pandas")) framework = "data-science"
			} catch (error) {
				// Ignore errors reading requirements
			}
		} else if (workspaceFiles.includes("Cargo.toml")) {
			language = "rust"
			packageManager = "cargo"
		} else if (workspaceFiles.includes("go.mod")) {
			language = "go"
		} else if (workspaceFiles.includes("pom.xml")) {
			language = "java"
			packageManager = "maven"
		}

		return {
			language,
			framework,
			packageManager,
			workspaceName: path.basename(this.workspacePath),
		}
	}

	private async scanWorkspaceFiles(): Promise<string[]> {
		try {
			const files = await fs.readdir(this.workspacePath)
			return files
		} catch (error) {
			console.error("Failed to scan workspace files:", error)
			return []
		}
	}

	private async _recreateServices(): Promise<void> {
		// Stop processing if it exists
		if (this._orchestrator) {
			this._orchestrator.stopProcessing()
		}

		// Clear existing services to ensure clean state
		this._orchestrator = undefined
		this._searchService = undefined

		// (Re)Initialize service factory
		this._serviceFactory = new ConversationMemoryServiceFactory(
			this._configManager!,
			this.workspacePath,
			this._cacheManager!,
			this._projectContext!,
		)

		// Create service instances
		const services = await this._serviceFactory.createServices(this.context)

		// Validate configuration before proceeding
		const validationResult = await this._serviceFactory.validateConfiguration()
		if (!validationResult.valid) {
			const errorMessage = validationResult.error || "Memory service configuration validation failed"
			this._stateManager.setSystemState("Error", errorMessage)
			throw new Error(errorMessage)
		}

		// (Re)Initialize orchestrator
		this._orchestrator = new ConversationMemoryOrchestrator(
			this._configManager!,
			this._stateManager,
			this.workspacePath,
			this._cacheManager!,
			services.vectorStore,
			services.factExtractor,
			services.conflictResolver,
			services.temporalManager,
			services.conversationProcessor,
		)

		// (Re)Initialize search service
		this._searchService = new ConversationMemorySearchService(
			this._configManager!,
			this._stateManager,
			services.embedder,
			services.vectorStore,
			services.temporalManager,
		)

		// Clear any error state after successful recreation
		this._stateManager.setSystemState("Standby", "")
	}

	public async handleSettingsChange(): Promise<void> {
		if (this._configManager) {
			const { requiresRestart } = await this._configManager.loadConfiguration()

			const isFeatureEnabled = this.isFeatureEnabled
			const isFeatureConfigured = this.isFeatureConfigured

			// If feature is disabled, stop the service
			if (!isFeatureEnabled) {
				if (this._orchestrator) {
					this._orchestrator.stopProcessing()
				}
				this._stateManager.setSystemState("Standby", "Conversation memory is disabled")
				return
			}

			if (requiresRestart && isFeatureEnabled && isFeatureConfigured) {
				try {
					// Ensure cacheManager is initialized before recreating services
					if (!this._cacheManager) {
						this._cacheManager = new ConversationMemoryCacheManager(this.context, this.workspacePath)
						await this._cacheManager.initialize()
					}

					// Recreate services with new configuration
					await this._recreateServices()
				} catch (error) {
					console.error("Failed to recreate memory services:", error)
					throw error
				}
			}
		}
	}

	// Generate unique collection name for this workspace
	public getMemoryCollectionName(): string {
		const hash = createHash("sha256").update(this.workspacePath).digest("hex")
		return `ws-${hash.substring(0, 16)}-memory`
	}
}
