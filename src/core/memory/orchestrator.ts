import * as crypto from "crypto"
import * as path from "path"
import { execSync } from "child_process"
import type { ProviderSettings } from "@roo-code/types"
import { MemoryStore } from "./memory-store"
import { preprocessMessages, type MessageLike } from "./preprocessor"
import { runAnalysis } from "./analysis-agent"
import { processObservations } from "./memory-writer"
import { compileMemoryPrompt, compileMemoryForAgent } from "./prompt-compiler"
import { MEMORY_CONSTANTS } from "./types"
import { readApiMessages } from "../task-persistence/apiMessages"

function getWorkspaceId(workspacePath: string): string {
	const folderName = path.basename(workspacePath)
	let gitRemote: string | null = null
	try {
		gitRemote = execSync("git remote get-url origin", {
			cwd: workspacePath,
			encoding: "utf-8",
			timeout: 3000,
		}).trim()
	} catch {
		// Not a git repo or no remote
	}
	const raw = gitRemote ? `${gitRemote}::${folderName}` : folderName
	return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)
}

/** Top-level coordinator that drives the memory analysis pipeline. */
export class MemoryOrchestrator {
	private store: MemoryStore
	private messageCounter = 0
	private watermark = 0
	private analysisInFlight = false
	private analysisQueued = false
	private syncInProgress = false
	private syncCompleted = 0
	private syncTotal = 0
	private enabled = false
	private workspaceId: string | null = null
	private analysisFrequency: number
	private initPromise: Promise<void>

	constructor(
		private storagePath: string,
		private workspacePath: string | null,
		analysisFrequency?: number,
	) {
		this.store = new MemoryStore(storagePath)
		this.analysisFrequency = analysisFrequency || MEMORY_CONSTANTS.DEFAULT_ANALYSIS_FREQUENCY
		if (workspacePath) {
			this.workspaceId = getWorkspaceId(workspacePath)
		}
		// Placeholder; replaced by the real init promise when init() is called.
		this.initPromise = Promise.resolve()
	}

	async init(): Promise<void> {
		this.initPromise = this.store.init()
		await this.initPromise
	}

	/** Wait for the store to be fully initialized. Resolves immediately after init completes. */
	async waitForReady(): Promise<void> {
		await this.initPromise
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled
		if (!enabled) {
			this.messageCounter = 0
		}
	}

	isEnabled(): boolean {
		return this.enabled
	}

	/** Return the current sync status so the webview can restore progress on re-mount. */
	getSyncStatus(): { inProgress: boolean; completed: number; total: number } {
		return {
			inProgress: this.syncInProgress,
			completed: this.syncCompleted,
			total: this.syncTotal,
		}
	}

	/**
	 * Call this on each user message during an active chat session.
	 * Returns true if an analysis cycle was triggered.
	 */
	onUserMessage(
		messages: unknown[],
		taskId: string | null,
		providerSettings: ProviderSettings | null,
	): boolean {
		if (!this.enabled || !providerSettings) return false

		this.messageCounter++
		console.log(`[Memory] onUserMessage: counter=${this.messageCounter}/${this.analysisFrequency}`)

		if (this.messageCounter >= this.analysisFrequency) {
			console.log(`[Memory] onUserMessage: trigger threshold reached, firing analysis`)
			this.triggerAnalysis(messages, taskId, providerSettings)
			this.messageCounter = 0
			return true
		}

		return false
	}

	/**
	 * Call on session end to catch remaining unanalyzed messages.
	 */
	onSessionEnd(
		messages: unknown[],
		taskId: string | null,
		providerSettings: ProviderSettings | null,
	): void {
		if (!this.enabled || !providerSettings) return
		if (this.watermark < messages.length) {
			this.triggerAnalysis(messages, taskId, providerSettings)
		}
	}

	private async triggerAnalysis(
		messages: unknown[],
		taskId: string | null,
		providerSettings: ProviderSettings,
	): Promise<void> {
		// Ensure the store is initialized before any DB access
		try {
			await this.initPromise
		} catch {
			// init() failed – bail out rather than crash
			return
		}

		if (this.analysisInFlight) {
			this.analysisQueued = true
			return
		}

		this.analysisInFlight = true

		try {
			// Grab messages since last watermark
			const batch = messages.slice(this.watermark)
			this.watermark = messages.length

			console.log(`[Memory] triggerAnalysis: batch size=${batch.length}, watermark=${this.watermark}`)

			if (batch.length === 0) return

			// Preprocess
			const preprocessed = preprocessMessages(batch as MessageLike[])
			console.log(`[Memory] triggerAnalysis: preprocessed token estimate=${preprocessed.cleanedTokenEstimate}, cleaned length=${preprocessed.cleaned.trim().length}`)
			if (preprocessed.cleaned.trim().length === 0) return

			// Get existing memory for context
			const scoredEntries = this.store.getScoredEntries(this.workspaceId)
			const existingReport = compileMemoryForAgent(scoredEntries)

			// Run analysis
			const result = await runAnalysis(providerSettings, preprocessed.cleaned, existingReport)

			if (result && result.observations.length > 0) {
				const writeResult = processObservations(
					this.store,
					result.observations,
					this.workspaceId,
					taskId,
				)

				// Log the analysis
				this.store.logAnalysis({
					id: crypto.randomUUID(),
					timestamp: Math.floor(Date.now() / 1000),
					taskId,
					messagesAnalyzed: batch.length,
					tokensUsed: preprocessed.cleanedTokenEstimate * 2, // rough: input + output
					entriesCreated: writeResult.entriesCreated,
					entriesReinforced: writeResult.entriesReinforced,
				})

				// Run garbage collection
				this.store.garbageCollect()
			}
		} catch (error) {
			console.error("[MemoryOrchestrator] Analysis pipeline error:", error)
		} finally {
			this.analysisInFlight = false

			if (this.analysisQueued) {
				this.analysisQueued = false
				// Re-trigger with current state
				this.triggerAnalysis(messages, taskId, providerSettings)
			}
		}
	}

	/**
	 * Analyze a batch of prior chat histories to bootstrap the memory database.
	 * Processes each task sequentially to avoid API rate limits.
	 */
	isSyncInProgress(): boolean {
		return this.syncInProgress
	}

	async batchAnalyzeHistory(
		taskIds: string[],
		globalStoragePath: string,
		providerSettings: ProviderSettings,
		onProgress: (completed: number, total: number) => void,
	): Promise<{ totalAnalyzed: number; entriesCreated: number; entriesReinforced: number }> {
		if (this.syncInProgress) {
			return { totalAnalyzed: 0, entriesCreated: 0, entriesReinforced: 0 }
		}

		this.syncInProgress = true
		this.syncCompleted = 0
		this.syncTotal = taskIds.length

		let totalAnalyzed = 0
		let entriesCreated = 0
		let entriesReinforced = 0

		try {
			for (let i = 0; i < taskIds.length; i++) {
			const taskId = taskIds[i]
			console.log(`[Memory] batchAnalyzeHistory: processing task ${i + 1}/${taskIds.length}, taskId=${taskId}`)

			try {
				// Read conversation history for this task
				const messages = await readApiMessages({ taskId, globalStoragePath })

				if (!messages || messages.length === 0) {
					console.log(`[Memory] batchAnalyzeHistory: no messages found for task ${taskId}`)
					onProgress(i + 1, taskIds.length)
					continue
				}

				console.log(`[Memory] batchAnalyzeHistory: found ${messages.length} messages for task ${taskId}`)

				// Preprocess
				const preprocessed = preprocessMessages(messages as MessageLike[])
				if (preprocessed.cleaned.trim().length === 0) {
					console.log(`[Memory] batchAnalyzeHistory: preprocessed to empty for task ${taskId}`)
					onProgress(i + 1, taskIds.length)
					continue
				}

				// Get existing memory for context
				const scoredEntries = this.store.getScoredEntries(this.workspaceId)
				const existingReport = compileMemoryForAgent(scoredEntries)

				// Run analysis
				const result = await runAnalysis(providerSettings, preprocessed.cleaned, existingReport)

				console.log(`[Memory] batchAnalyzeHistory: analysis returned ${result ? result.observations.length : 0} observations for task ${taskId}`)

				if (result && result.observations.length > 0) {
					const writeResult = processObservations(
						this.store,
						result.observations,
						this.workspaceId,
						taskId,
					)

					entriesCreated += writeResult.entriesCreated
					entriesReinforced += writeResult.entriesReinforced

					// Log the analysis
					this.store.logAnalysis({
						id: crypto.randomUUID(),
						timestamp: Math.floor(Date.now() / 1000),
						taskId,
						messagesAnalyzed: messages.length,
						tokensUsed: preprocessed.cleanedTokenEstimate * 2,
						entriesCreated: writeResult.entriesCreated,
						entriesReinforced: writeResult.entriesReinforced,
					})
				}

				totalAnalyzed++
			} catch (error) {
				console.error(`[MemoryOrchestrator] Batch analysis error for task ${taskId}:`, error)
			}

			this.syncCompleted = i + 1
			onProgress(i + 1, taskIds.length)
		}

		// Run garbage collection after all tasks
		this.store.garbageCollect()

		return { totalAnalyzed, entriesCreated, entriesReinforced }
		} finally {
			this.syncInProgress = false
			this.syncCompleted = 0
			this.syncTotal = 0
		}
	}

	/**
	 * Clear all memory entries and analysis logs.
	 */
	clearAllMemory(): void {
		this.store.deleteAllEntries()
	}

	/**
	 * Get the compiled user profile section for the system prompt.
	 * Awaits store initialization so early calls (before init resolves) return
	 * real data instead of an empty string.
	 */
	async getUserProfileSection(): Promise<string> {
		try {
			await this.initPromise
		} catch {
			// init() failed – store has no DB, getScoredEntries will return []
		}
		const entries = this.store.getScoredEntries(this.workspaceId)
		const compiled = compileMemoryPrompt(entries)
		console.log(`[Memory] getUserProfileSection: ${entries.length} entries, compiled prompt length=${compiled.length}`)
		return compiled
	}

	getStore(): MemoryStore {
		return this.store
	}

	close(): void {
		this.store.close()
	}
}
