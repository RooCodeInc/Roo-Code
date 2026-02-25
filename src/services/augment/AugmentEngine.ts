/**
 * AugmentEngine — Joe AI's high-context intelligence orchestrator.
 *
 * This is the single entry point that wires together all Augment-style features:
 *   - MemoryManager        (Phase 1: cross-session persistent memory)
 *   - ContinuousIndexer    (Phase 2: always-on background indexing)
 *   - SmartContextSelector (Phase 3: RAG-based auto context selection)
 *   - ProactiveAnalyzer    (Phase 4: proactive code suggestions)
 *   - MultiFileRefactorAnalyzer (Phase 6: cross-file refactor impact)
 *
 * The Augment mode (Phase 5) is registered in DEFAULT_MODES (packages/types/src/mode.ts)
 * and uses this engine for all its capabilities.
 *
 * Usage in extension.ts:
 *   const engine = await AugmentEngine.initialize(context, workspacePath)
 *   engine.onReady(() => console.log("Joe AI context engine ready"))
 */

import * as vscode from "vscode"
import path from "path"
import { MemoryManager } from "./MemoryManager"
import { ContinuousIndexer, IndexingUpdate } from "./ContinuousIndexer"
import { SmartContextSelector, SmartContextResult } from "./SmartContextSelector"
import { ProactiveAnalyzer, AnalysisResult } from "./ProactiveAnalyzer"
import { MultiFileRefactorAnalyzer, ImpactMap } from "./MultiFileRefactorAnalyzer"
import { CodeIndexManager } from "../code-index/manager"

export interface AugmentEngineOptions {
	enableContinuousIndexing?: boolean
	enableProactiveAnalysis?: boolean
	enablePersistentMemory?: boolean
	maxContextFiles?: number
}

export interface EnrichedContext {
	memoryContext: string
	smartContext: SmartContextResult
	proactiveSuggestions: AnalysisResult | null
	formattedForPrompt: string
}

const DEFAULT_OPTIONS: Required<AugmentEngineOptions> = {
	enableContinuousIndexing: true,
	enableProactiveAnalysis: true,
	enablePersistentMemory: true,
	maxContextFiles: 8,
}

export class AugmentEngine {
	private static instances = new Map<string, AugmentEngine>()

	public readonly memory: MemoryManager
	public readonly indexer: ContinuousIndexer
	public readonly contextSelector: SmartContextSelector
	public readonly proactiveAnalyzer: ProactiveAnalyzer
	public readonly refactorAnalyzer: MultiFileRefactorAnalyzer

	private readyCallbacks: Array<() => void> = []
	private isReady = false
	private statusBarItem: vscode.StatusBarItem | undefined
	private options: Required<AugmentEngineOptions>

	static getInstance(workspacePath: string): AugmentEngine | undefined {
		return this.instances.get(workspacePath)
	}

	/**
	 * Initialize the full Augment Engine for a workspace.
	 * Call once from extension.ts on activation.
	 */
	static async initialize(
		context: vscode.ExtensionContext,
		workspacePath: string,
		options: AugmentEngineOptions = {},
	): Promise<AugmentEngine> {
		if (this.instances.has(workspacePath)) {
			return this.instances.get(workspacePath)!
		}

		const engine = new AugmentEngine(context, workspacePath, options)
		this.instances.set(workspacePath, engine)
		await engine.start()
		return engine
	}

	static disposeAll(): void {
		for (const engine of this.instances.values()) {
			engine.dispose()
		}
		this.instances.clear()
	}

	private constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly workspacePath: string,
		options: AugmentEngineOptions = {},
	) {
		this.options = { ...DEFAULT_OPTIONS, ...options }

		// Initialize all sub-systems
		this.memory = MemoryManager.getInstance(context, workspacePath)
		this.indexer = ContinuousIndexer.getInstance(workspacePath)
		this.contextSelector = SmartContextSelector.getInstance(context, workspacePath, this.memory)
		this.proactiveAnalyzer = ProactiveAnalyzer.getInstance(workspacePath)
		this.refactorAnalyzer = MultiFileRefactorAnalyzer.getInstance(workspacePath)
	}

	// --- Lifecycle ---

	private async start(): Promise<void> {
		// Set up status bar
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
		this.updateStatusBar("initializing", "Joe AI initializing...")
		this.statusBarItem.show()

		// Phase 1: Load persistent memory
		if (this.options.enablePersistentMemory) {
			await this.memory.initialize()
		}

		// Phase 2: Wire continuous indexer to CodeIndexManager
		if (this.options.enableContinuousIndexing) {
			const codeIndexManager = CodeIndexManager.getInstance(this.context, this.workspacePath)
			if (codeIndexManager) {
				this.indexer.setIndexCallbacks(
					async (filePath: string) => {
						// Trigger re-indexing of individual file via the manager's startIndexing
						// The file watcher in CodeIndexManager will pick it up
						// We emit a signal to refresh
					},
					async () => {
						await codeIndexManager.startIndexing()
					},
				)
			}

			// Listen to indexer updates for status bar
			this.indexer.on("update", (update: IndexingUpdate) => {
				if (update.status === "indexing") {
					this.updateStatusBar("indexing", update.message ?? `Indexing ${update.currentFile ?? "..."}`)
				} else if (update.status === "ready") {
					this.updateStatusBar("ready", "Joe AI context ready")
					this.markReady()
				} else if (update.status === "error") {
					this.updateStatusBar("error", update.message ?? "Index error")
				}
			})

			this.indexer.on("ready", () => {
				this.markReady()
			})

			await this.indexer.activate()
		} else {
			this.markReady()
		}
	}

	private markReady(): void {
		if (this.isReady) return
		this.isReady = true
		this.updateStatusBar("ready", "Joe AI context ready")
		for (const cb of this.readyCallbacks) {
			cb()
		}
		this.readyCallbacks = []
	}

	// --- Public API ---

	/**
	 * Register a callback to run when the engine is fully initialized.
	 */
	onReady(callback: () => void): void {
		if (this.isReady) {
			callback()
		} else {
			this.readyCallbacks.push(callback)
		}
	}

	/**
	 * Build enriched context for an AI prompt.
	 * This is the core function — call this before every API call in augment mode.
	 *
	 * @param query - The user's message/query
	 * @param activeFile - Currently open file path (optional)
	 * @param recentChanges - Files recently changed (for proactive analysis)
	 */
	async buildEnrichedContext(
		query: string,
		activeFile?: string,
		recentChanges?: string[],
	): Promise<EnrichedContext> {
		const [smartContext, proactiveSuggestions] = await Promise.all([
			this.options.enablePersistentMemory
				? this.contextSelector.selectContext(query, activeFile)
				: Promise.resolve({ files: [], totalTokensEstimated: 0, query, selectionReason: "disabled" }),
			this.options.enableProactiveAnalysis && recentChanges?.length
				? this.proactiveAnalyzer.analyzeChanges(recentChanges)
				: Promise.resolve(null),
		])

		const memoryContext = this.options.enablePersistentMemory
			? this.memory.buildMemoryContext(smartContext.files.map((f) => f.filePath))
			: ""

		const formattedParts: string[] = []

		if (memoryContext) {
			formattedParts.push(memoryContext)
		}

		if (smartContext.files.length > 0) {
			formattedParts.push(this.contextSelector.formatContextForPrompt(smartContext))
		}

		if (proactiveSuggestions && proactiveSuggestions.suggestions.length > 0) {
			formattedParts.push(this.proactiveAnalyzer.formatSuggestionsForPrompt(proactiveSuggestions))
		}

		return {
			memoryContext,
			smartContext,
			proactiveSuggestions,
			formattedForPrompt: formattedParts.join("\n"),
		}
	}

	/**
	 * Analyze refactor impact before making changes.
	 * Call this when the user asks to rename/move/refactor a symbol.
	 */
	async analyzeRefactorImpact(symbolName: string, sourceFilePath: string): Promise<ImpactMap> {
		return this.refactorAnalyzer.analyzeSymbolImpact(symbolName, sourceFilePath)
	}

	/**
	 * Record that a file was edited (feeds into memory + proactive analysis).
	 * Call this from tool handlers after any write_to_file / edit_file operation.
	 */
	recordFileEdit(filePath: string, summary: string = "", language: string = ""): void {
		if (!language) {
			const ext = path.extname(filePath).slice(1)
			language = ext || "unknown"
		}
		if (this.options.enablePersistentMemory) {
			this.memory.recordFileEdit(filePath, language, summary)
		}
		if (this.options.enableContinuousIndexing) {
			this.indexer.indexFile(filePath).catch(console.error)
		}
	}

	/**
	 * End the current session with a summary.
	 * Call this from Task.ts when a task completes.
	 */
	endSession(summary: string): void {
		if (this.options.enablePersistentMemory) {
			this.memory.endSession(summary)
		}
	}

	/**
	 * Get engine status for display in UI.
	 */
	getStatus(): {
		isReady: boolean
		indexingStatus: string
		memoryFiles: number
		recentSessions: number
	} {
		const indexStatus = this.indexer.getStatus()
		return {
			isReady: this.isReady,
			indexingStatus: indexStatus.status,
			memoryFiles: this.memory.getFrequentlyEditedFiles(100).length,
			recentSessions: this.memory.getRecentDecisions(100).length,
		}
	}

	dispose(): void {
		this.statusBarItem?.dispose()
		this.indexer.dispose()
		this.memory.dispose()
		this.proactiveAnalyzer.dispose()
		SmartContextSelector.disposeAll()
		MultiFileRefactorAnalyzer.disposeAll()
	}

	// --- Private Helpers ---

	private updateStatusBar(
		state: "initializing" | "indexing" | "ready" | "error",
		message: string,
	): void {
		if (!this.statusBarItem) return
		const icons: Record<string, string> = {
			initializing: "$(sync~spin)",
			indexing: "$(loading~spin)",
			ready: "$(brain)",
			error: "$(warning)",
		}
		this.statusBarItem.text = `${icons[state]} Joe AI: ${message}`
		this.statusBarItem.tooltip = `Joe AI Augment Engine — ${message}`
		this.statusBarItem.command = state === "ready" ? "joe-code.showAugmentStatus" : undefined
	}
}
